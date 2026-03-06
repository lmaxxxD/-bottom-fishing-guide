const { linearScoreInverse, linearScore, simpleMA, rollingMA } = require('../fetchers/common');
const { compositeScore, scoreSignal } = require('./scoring');

function analyzeHKStocks(data) {
  const indicators = [];
  const closes = data.klines ? data.klines.map(k => k.close) : [];

  // 1. 价格历史分位 (权重30%)
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

  // 2. AH溢价指数 (权重35%)
  if (data.ahPremium && data.ahPremium.length > 0) {
    const latest = data.ahPremium[data.ahPremium.length - 1].close;
    const score = linearScore(latest, 110, 150);
    indicators.push({
      name: 'AH溢价指数',
      value: latest.toFixed(1),
      unit: '',
      score,
      weight: 0.35,
      signal: latest > 140 ? '港股极便宜' : latest > 130 ? '港股便宜' : latest > 120 ? '港股偏便宜' : latest > 110 ? '接近平价' : '港股偏贵'
    });
  }

  // 3. 南向资金趋势 (权重35%)
  if (data.southboundData && data.southboundData.length >= 5) {
    const recent5 = data.southboundData.slice(0, 5);
    const recent30 = data.southboundData.slice(0, Math.min(30, data.southboundData.length));
    const avg5 = recent5.reduce((s, d) => s + (d.netBuy || 0), 0) / recent5.length;
    const avg30 = recent30.reduce((s, d) => s + (d.netBuy || 0), 0) / recent30.length;
    let ratio = avg30 !== 0 ? (avg5 / Math.abs(avg30)) : 0;
    const score = linearScore(ratio, -1, 3);
    indicators.push({
      name: '南向资金趋势',
      value: (avg5 / 10000).toFixed(1),
      unit: '亿/日',
      score,
      weight: 0.35,
      signal: ratio > 2 ? '大幅涌入' : ratio > 1 ? '持续流入' : ratio > 0 ? '小幅流入' : '资金外流'
    });
  }

  const totalScore = compositeScore(indicators);
  const signal = scoreSignal(totalScore);

  let history7d = [];
  if (data.klines && data.klines.length >= 7) {
    history7d = data.klines.slice(-7).map(k => ({ date: k.date, close: k.close }));
  }

  // === Detail data ===
  const detail = {};

  if (data.klines && data.klines.length >= 30) {
    detail.kline30d = data.klines.slice(-30).map(k => ({
      date: k.date, open: k.open, high: k.high, low: k.low, close: k.close
    }));
  }

  if (closes.length >= 60) {
    const dates = data.klines.map(k => k.date);
    const last30Dates = dates.slice(-30);
    detail.ma = {
      ma5: rollingMA(closes, dates, 5).filter(m => last30Dates.includes(m.date)),
      ma20: rollingMA(closes, dates, 20).filter(m => last30Dates.includes(m.date)),
      ma60: rollingMA(closes, dates, 60).filter(m => last30Dates.includes(m.date))
    };
  }

  // Aux chart: AH premium 90-day trend
  if (data.ahPremium && data.ahPremium.length >= 30) {
    const ah90 = data.ahPremium.slice(-90);
    detail.auxChart = {
      type: 'line',
      title: 'AH溢价指数走势 (近90日)',
      unit: '',
      data: ah90.map(d => ({ date: d.date.slice(5), value: d.close }))
    };
  }

  // Narrative
  const narParts = [];
  for (const ind of indicators) {
    if (ind.name === '价格历史分位') {
      narParts.push(`恒生指数处于500日价格区间的${ind.value}%位置，${ind.signal}。`);
    } else if (ind.name === 'AH溢价指数') {
      const v = parseFloat(ind.value);
      narParts.push(`AH溢价指数为${ind.value}，表示A股平均比港股贵${(v - 100).toFixed(0)}%，${ind.signal}。${v > 130 ? '港股相对A股折价显著，存在价差套利空间。' : '港股相对A股折价不大。'}`);
    } else if (ind.name === '南向资金趋势') {
      narParts.push(`南向资金日均净买入${ind.value}亿，${ind.signal}。`);
    }
  }
  if (totalScore != null) {
    if (totalScore >= 70) narParts.push('综合来看，港股处于价值洼地，多指标共振显示抄底机会。');
    else if (totalScore >= 50) narParts.push('综合来看，港股估值有一定吸引力，可适度关注。');
    else narParts.push('综合来看，当前港股信号偏中性，建议观望。');
  }
  detail.narrative = narParts.join('\n');

  return {
    name: '港股',
    id: 'hkstocks',
    subtitle: '恒生指数',
    score: totalScore,
    signal,
    indicators,
    history7d,
    price: data.price,
    detail
  };
}

module.exports = { analyzeHKStocks };
