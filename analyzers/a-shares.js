const { linearScoreInverse, linearScore, simpleMA, rollingMA } = require('../fetchers/common');
const { compositeScore, scoreSignal } = require('./scoring');

function analyzeAShares(data) {
  const indicators = [];
  const closes = data.klines ? data.klines.map(k => k.close) : [];

  // 1. 价格历史分位 (权重30%)
  // 当前价格在500日区间的位置，越低越适合抄底
  if (closes.length >= 200) {
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const latest = closes[closes.length - 1];
    const pctRank = ((latest - min) / (max - min)) * 100;
    const score = linearScoreInverse(pctRank, 10, 90);
    indicators.push({
      name: '价格历史分位',
      value: pctRank.toFixed(0),
      unit: '%',
      score,
      weight: 0.30,
      signal: pctRank < 20 ? '接近底部' : pctRank < 40 ? '偏低区间' : pctRank < 60 ? '中间位置' : pctRank < 80 ? '偏高区间' : '接近顶部'
    });
  }

  // 2. 200MA偏离度 (权重30%)
  if (closes.length >= 200) {
    const ma200 = simpleMA(closes, 200);
    const latest = closes[closes.length - 1];
    const deviation = ((latest - ma200) / ma200) * 100;
    const score = linearScoreInverse(deviation, -15, 20);
    indicators.push({
      name: '200日均线偏离',
      value: deviation.toFixed(1),
      unit: '%',
      score,
      weight: 0.30,
      signal: deviation < -15 ? '严重超卖' : deviation < -5 ? '超卖' : deviation < 5 ? '正常' : deviation < 15 ? '偏热' : '严重过热'
    });
  }

  // 3. 换手率异动 (权重20%)
  if (data.turnoverRate != null) {
    const tr = data.turnoverRate;
    const score = linearScoreInverse(tr, 0.3, 2.0);
    indicators.push({
      name: '换手率',
      value: tr.toFixed(2),
      unit: '%',
      score,
      weight: 0.20,
      signal: tr < 0.3 ? '极度冷清' : tr < 0.6 ? '偏冷清' : tr < 1.2 ? '正常' : tr < 2.0 ? '活跃' : '狂热'
    });
  }

  // 4. 跨境资金趋势 (权重20%)
  if (data.crossBorderFlow && data.crossBorderFlow.length >= 5) {
    const recent5 = data.crossBorderFlow.slice(0, 5);
    const recent30 = data.crossBorderFlow.slice(0, Math.min(30, data.crossBorderFlow.length));
    const avg5 = recent5.reduce((s, d) => s + d.netDeal, 0) / recent5.length;
    const avg30 = recent30.reduce((s, d) => s + d.netDeal, 0) / recent30.length;
    // 南向净流出(负值) = 资金回流A股 = 利好A股(高分)
    // 南向净流入(正值) = 资金流出A股 = 利空A股(低分)
    const score = linearScoreInverse(avg5, -50000, 50000);
    indicators.push({
      name: '南向资金净流',
      value: (avg5 / 10000).toFixed(1),
      unit: '亿/日',
      score,
      weight: 0.20,
      signal: avg5 < -20000 ? '大幅回流A股' : avg5 < 0 ? '资金回流A股' : avg5 < 20000 ? '小幅流入港股' : '大幅流入港股'
    });
  }

  const totalScore = compositeScore(indicators);
  const signal = scoreSignal(totalScore);

  let history7d = [];
  if (data.klines && data.klines.length >= 7) {
    history7d = data.klines.slice(-7).map(k => ({ date: k.date, close: k.close }));
  }

  // === Detail data for detail page ===
  const detail = {};

  // 30-day K-line
  if (data.klines && data.klines.length >= 30) {
    detail.kline30d = data.klines.slice(-30).map(k => ({
      date: k.date, open: k.open, high: k.high, low: k.low, close: k.close
    }));
  }

  // Rolling MAs for chart overlay
  if (closes.length >= 60) {
    const dates = data.klines.map(k => k.date);
    const last30Dates = dates.slice(-30);
    detail.ma = {
      ma5: rollingMA(closes, dates, 5).filter(m => last30Dates.includes(m.date)),
      ma20: rollingMA(closes, dates, 20).filter(m => last30Dates.includes(m.date)),
      ma60: rollingMA(closes, dates, 60).filter(m => last30Dates.includes(m.date))
    };
  }

  // Aux chart: southbound fund flow 30 days
  if (data.crossBorderFlow && data.crossBorderFlow.length >= 5) {
    detail.auxChart = {
      type: 'bar',
      title: '南向资金净流入 (近30日)',
      unit: '亿',
      data: data.crossBorderFlow.slice(0, 30).reverse().map(d => ({
        date: d.date.split(' ')[0].slice(5),
        value: +(d.netDeal / 10000).toFixed(2)
      }))
    };
  }

  // Narrative
  const narParts = [];
  for (const ind of indicators) {
    if (ind.name === '价格历史分位') {
      narParts.push(`当前沪深300处于500日价格区间的${ind.value}%位置，${ind.signal}。`);
    } else if (ind.name === '200日均线偏离') {
      narParts.push(`价格偏离200日均线${ind.value}%，${ind.signal}。`);
    } else if (ind.name === '换手率') {
      narParts.push(`换手率${ind.value}%，${ind.signal}，${parseFloat(ind.value) < 0.6 ? '市场情绪较为冷淡，可能接近阶段性底部' : parseFloat(ind.value) > 1.5 ? '交投活跃，追高需谨慎' : '交投水平正常'}。`);
    } else if (ind.name === '南向资金净流') {
      narParts.push(`南向资金日均净流${parseFloat(ind.value) > 0 ? '入港股' : '回A股'}${Math.abs(parseFloat(ind.value)).toFixed(1)}亿，${ind.signal}。`);
    }
  }
  if (totalScore != null) {
    if (totalScore >= 70) narParts.push('综合来看，多项指标显示当前存在较好的抄底机会，可考虑分批建仓。');
    else if (totalScore >= 50) narParts.push('综合来看，部分指标偏积极，建议保持关注，等待更明确的信号。');
    else narParts.push('综合来看，当前估值偏高或趋势偏强，建议观望为主，等待回调。');
  }
  detail.narrative = narParts.join('\n');

  return {
    name: 'A股',
    id: 'ashares',
    subtitle: '沪深300',
    score: totalScore,
    signal,
    indicators,
    history7d,
    price: data.price,
    detail
  };
}

module.exports = { analyzeAShares };
