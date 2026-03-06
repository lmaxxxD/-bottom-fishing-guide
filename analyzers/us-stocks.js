const { linearScore, linearScoreInverse, simpleMA, rollingMA } = require('../fetchers/common');
const { compositeScore, scoreSignal } = require('./scoring');

function analyzeUSStocks(data) {
  const indicators = [];
  const sp500Closes = data.sp500 ? data.sp500.map(d => d.close) : [];

  // 1. S&P500 200MA偏离度 (权重35%)
  if (sp500Closes.length >= 200) {
    const ma200 = simpleMA(sp500Closes, 200);
    const latest = sp500Closes[sp500Closes.length - 1];
    const deviation = ((latest - ma200) / ma200) * 100;
    const score = linearScoreInverse(deviation, -20, 30);
    indicators.push({
      name: 'S&P500 200MA偏离',
      value: deviation.toFixed(1),
      unit: '%',
      score,
      weight: 0.35,
      signal: deviation < -20 ? '严重超卖' : deviation < -10 ? '超卖' : deviation < 10 ? '正常' : deviation < 20 ? '偏热' : '严重过热'
    });
  }

  // 2. VIXY恐慌代理 (权重30%)
  // VIXY越高=市场越恐慌=越适合抄底
  if (data.vixy && data.vixy.length >= 30) {
    const vixCloses = data.vixy.map(d => d.close);
    const latest = vixCloses[vixCloses.length - 1];
    const ma60 = simpleMA(vixCloses, Math.min(60, vixCloses.length));
    const deviation = ((latest - ma60) / ma60) * 100;
    // VIXY高于均值=恐慌=买入信号(高分)
    const score = linearScore(deviation, -30, 60);
    indicators.push({
      name: 'VIXY恐慌指标',
      value: latest.toFixed(1),
      unit: '',
      score,
      weight: 0.30,
      signal: deviation > 50 ? '极度恐惧' : deviation > 20 ? '恐惧' : deviation > -10 ? '正常' : '市场自满'
    });
  }

  // 3. S&P500价格分位 (权重35%)
  if (sp500Closes.length >= 200) {
    const min = Math.min(...sp500Closes);
    const max = Math.max(...sp500Closes);
    const latest = sp500Closes[sp500Closes.length - 1];
    const pctRank = ((latest - min) / (max - min)) * 100;
    const score = linearScoreInverse(pctRank, 10, 90);
    indicators.push({
      name: 'S&P500价格分位',
      value: pctRank.toFixed(0),
      unit: '%',
      score,
      weight: 0.35,
      signal: pctRank < 20 ? '接近底部' : pctRank < 40 ? '偏低区间' : pctRank < 60 ? '中间位置' : pctRank < 80 ? '偏高区间' : '接近顶部'
    });
  }

  const totalScore = compositeScore(indicators);
  const signal = scoreSignal(totalScore);

  let history7d = [];
  if (data.sp500 && data.sp500.length >= 7) {
    history7d = data.sp500.slice(-7).map(d => ({ date: d.date, close: d.close }));
  }

  // === Detail data ===
  const detail = {};

  if (data.sp500 && data.sp500.length >= 30) {
    detail.kline30d = data.sp500.slice(-30).map(d => ({
      date: d.date, open: d.open, high: d.high, low: d.low, close: d.close
    }));
  }

  if (sp500Closes.length >= 60) {
    const dates = data.sp500.map(d => d.date);
    const last30Dates = dates.slice(-30);
    detail.ma = {
      ma5: rollingMA(sp500Closes, dates, 5).filter(m => last30Dates.includes(m.date)),
      ma20: rollingMA(sp500Closes, dates, 20).filter(m => last30Dates.includes(m.date)),
      ma60: rollingMA(sp500Closes, dates, 60).filter(m => last30Dates.includes(m.date))
    };
  }

  // Aux chart: VIXY 60-day trend
  if (data.vixy && data.vixy.length >= 30) {
    const vixy60 = data.vixy.slice(-60);
    detail.auxChart = {
      type: 'line',
      title: 'VIXY恐慌指数走势 (近60日)',
      unit: '',
      data: vixy60.map(d => ({ date: d.date.slice(5), value: d.close }))
    };
  }

  // Narrative
  const narParts = [];
  for (const ind of indicators) {
    if (ind.name === 'S&P500 200MA偏离') {
      narParts.push(`S&P500偏离200日均线${ind.value}%，${ind.signal}。${parseFloat(ind.value) < -10 ? '价格严重低于长期均线，历史上通常是较好的入场时机。' : parseFloat(ind.value) > 15 ? '价格大幅偏离均线，存在均值回归风险。' : ''}`);
    } else if (ind.name === 'VIXY恐慌指标') {
      narParts.push(`VIXY恐慌代理指数当前为${ind.value}，${ind.signal}。${ind.score > 60 ? '市场恐慌情绪浓厚，"别人恐惧时贪婪"。' : ind.score < 30 ? '市场过于自满，需保持警惕。' : ''}`);
    } else if (ind.name === 'S&P500价格分位') {
      narParts.push(`S&P500处于500日价格区间的${ind.value}%位置，${ind.signal}。`);
    }
  }
  if (totalScore != null) {
    if (totalScore >= 70) narParts.push('综合来看，美股多项指标显示超卖，可考虑分批抄底。');
    else if (totalScore >= 50) narParts.push('综合来看，美股估值中性偏积极，可保持关注。');
    else narParts.push('综合来看，美股当前估值偏高，建议谨慎，等待更好的入场时机。');
  }
  detail.narrative = narParts.join('\n');

  return {
    name: '美股',
    id: 'usstocks',
    subtitle: 'S&P 500',
    score: totalScore,
    signal,
    indicators,
    history7d,
    price: data.sp500 ? data.sp500[data.sp500.length - 1]?.close : null,
    detail
  };
}

module.exports = { analyzeUSStocks };
