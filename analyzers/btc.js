const { scoreSignal } = require('./scoring');
const { rollingMA } = require('../fetchers/common');

function analyzeBTC(data) {
  const indicators = [];

  if (!data.latest) {
    return {
      name: 'BTC',
      id: 'btc',
      subtitle: '比特币',
      score: null,
      signal: '数据缺失',
      indicators: [],
      history7d: [],
      price: null,
      detail: {}
    };
  }

  const latest = data.latest;

  // If we have full BTCTracker data, use its indicators directly
  if (latest.indicators) {
    const ind = latest.indicators;

    if (ind.mvrvZScore != null) {
      indicators.push({
        name: 'MVRV Z-Score',
        value: ind.mvrvZScore.toFixed(2),
        unit: '',
        score: ind.mvrvZScore < 1 ? 80 : ind.mvrvZScore < 3 ? 60 : ind.mvrvZScore < 5 ? 40 : 20,
        weight: 0.15,
        signal: ind.mvrvZScore < 1 ? '低估区间' : ind.mvrvZScore < 3 ? '正常' : '高估'
      });
    }

    if (ind.fearGreed != null) {
      indicators.push({
        name: '恐惧贪婪指数',
        value: ind.fearGreed.toFixed(0),
        unit: '',
        score: ind.fearGreed < 25 ? 90 : ind.fearGreed < 40 ? 70 : ind.fearGreed < 60 ? 50 : ind.fearGreed < 75 ? 30 : 10,
        weight: 0.15,
        signal: ind.fearGreed < 25 ? '极度恐惧' : ind.fearGreed < 40 ? '恐惧' : ind.fearGreed < 60 ? '中性' : '贪婪'
      });
    }

    if (ind.ma200Dev != null) {
      indicators.push({
        name: '200MA偏离',
        value: ind.ma200Dev.toFixed(1),
        unit: '%',
        score: ind.ma200Dev < -30 ? 95 : ind.ma200Dev < -15 ? 80 : ind.ma200Dev < 0 ? 60 : ind.ma200Dev < 30 ? 40 : 15,
        weight: 0.20,
        signal: ind.ma200Dev < -20 ? '严重超卖' : ind.ma200Dev < 0 ? '低于均线' : '高于均线'
      });
    }

    if (ind.puell != null) {
      indicators.push({
        name: 'Puell Multiple',
        value: ind.puell.toFixed(2),
        unit: '',
        score: ind.puell < 0.5 ? 90 : ind.puell < 1.0 ? 65 : ind.puell < 2.0 ? 40 : 15,
        weight: 0.15,
        signal: ind.puell < 0.5 ? '矿工投降' : ind.puell < 1.0 ? '低收入期' : '正常'
      });
    }

    if (ind.piCycle != null) {
      indicators.push({
        name: 'Pi Cycle距离',
        value: ind.piCycle.toFixed(1),
        unit: '%',
        score: ind.piCycle > 50 ? 80 : ind.piCycle > 20 ? 55 : ind.piCycle > 5 ? 30 : 10,
        weight: 0.15,
        signal: ind.piCycle > 50 ? '远离顶部' : ind.piCycle > 20 ? '正常距离' : '接近交叉'
      });
    }

    if (ind.activeAddr != null) {
      indicators.push({
        name: '活跃地址变化',
        value: ind.activeAddr.toFixed(1),
        unit: '%',
        score: ind.activeAddr < -10 ? 80 : ind.activeAddr < 0 ? 60 : ind.activeAddr < 10 ? 45 : 30,
        weight: 0.10,
        signal: ind.activeAddr < -10 ? '活跃度下降' : ind.activeAddr < 0 ? '略有下降' : '活跃度上升'
      });
    }

    if (ind.volumeAnomaly != null) {
      indicators.push({
        name: '成交量异动',
        value: ind.volumeAnomaly.toFixed(2),
        unit: 'x',
        score: ind.volumeAnomaly > 2 ? 70 : ind.volumeAnomaly > 1.5 ? 55 : ind.volumeAnomaly > 0.5 ? 40 : 70,
        weight: 0.10,
        signal: ind.volumeAnomaly > 2 ? '放量(关注)' : ind.volumeAnomaly > 1 ? '正常' : '缩量'
      });
    }
  }

  // Use BTCTracker composite score directly if available
  const totalScore = latest.compositeScore || null;
  const signal = scoreSignal(totalScore);

  // 7-day history
  let history7d = [];
  if (data.history && data.history.length >= 7) {
    history7d = data.history.slice(0, 7).reverse().map(h => ({
      date: h.date,
      close: h.price
    }));
  }

  // === Detail data ===
  const detail = {};

  // Use GBTC K-line data from EastMoney for charts (real OHLC)
  if (data.klines && data.klines.length >= 7) {
    detail.kline30d = data.klines.slice(-30).map(k => ({
      date: k.date, open: k.open, high: k.high, low: k.low, close: k.close
    }));

    // Rolling MAs
    const closes = data.klines.map(k => k.close);
    const dates = data.klines.map(k => k.date);
    const last30Dates = dates.slice(-30);
    detail.ma = {
      ma5: rollingMA(closes, dates, 5).filter(m => last30Dates.includes(m.date)),
      ma20: rollingMA(closes, dates, 20).filter(m => last30Dates.includes(m.date)),
      ma60: rollingMA(closes, dates, 60).filter(m => last30Dates.includes(m.date))
    };
  } else if (data.history && data.history.length >= 7) {
    // Fallback: use BTCTracker history (no OHLC)
    detail.kline30d = data.history.slice(0, Math.min(30, data.history.length)).reverse().map(h => ({
      date: h.date, open: h.price, high: h.price, low: h.price, close: h.price
    }));
  }

  // Radar chart data from indicators
  if (indicators.length >= 3) {
    detail.radarChart = indicators.map(ind => ({
      name: ind.name.length > 8 ? ind.name.slice(0, 8) : ind.name,
      score: ind.score || 0
    }));
  }

  // Narrative
  const narParts = [];
  for (const ind of indicators) {
    if (ind.name === 'MVRV Z-Score') {
      narParts.push(`MVRV Z-Score为${ind.value}，${ind.signal}。${parseFloat(ind.value) < 1 ? 'MVRV低于1表示市场价值低于实现价值，历史上是较好的积累期。' : parseFloat(ind.value) > 5 ? 'MVRV极高，市场过热，注意风险。' : ''}`);
    } else if (ind.name === '恐惧贪婪指数') {
      narParts.push(`恐惧贪婪指数为${ind.value}，${ind.signal}。${parseInt(ind.value) < 25 ? '"极度恐惧时贪婪"——当前是历史上较好的买入时机。' : parseInt(ind.value) > 75 ? '市场极度贪婪，追高风险极大。' : ''}`);
    } else if (ind.name === '200MA偏离') {
      narParts.push(`BTC偏离200日均线${ind.value}%，${ind.signal}。`);
    } else if (ind.name === 'Puell Multiple') {
      narParts.push(`Puell倍数为${ind.value}，${ind.signal}。${parseFloat(ind.value) < 0.5 ? '矿工收入极低，历史上矿工投降往往对应价格底部。' : ''}`);
    }
  }
  if (totalScore != null) {
    if (totalScore >= 70) narParts.push('综合链上数据来看，多项指标显示当前BTC处于价值区间，是较好的定投/抄底时机。');
    else if (totalScore >= 50) narParts.push('综合来看，BTC链上指标中性偏积极，可保持关注。');
    else narParts.push('综合来看，BTC当前估值偏高，建议耐心等待更好的入场机会。');
  }
  detail.narrative = narParts.join('\n');

  return {
    name: 'BTC',
    id: 'btc',
    subtitle: '比特币',
    score: totalScore,
    signal,
    indicators,
    history7d,
    price: latest.price,
    detail
  };
}

module.exports = { analyzeBTC };
