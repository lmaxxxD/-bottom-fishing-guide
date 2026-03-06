const { linearScoreInverse, linearScore, simpleMA, rollingMA } = require('../fetchers/common');
const { compositeScore, scoreSignal } = require('./scoring');

function analyzeGold(data) {
  const indicators = [];
  const goldCloses = data.goldPrices ? data.goldPrices.map(d => d.close) : [];

  // 1. 金价200MA偏离度 (权重40%)
  if (goldCloses.length >= 200) {
    const ma200 = simpleMA(goldCloses, 200);
    const latest = goldCloses[goldCloses.length - 1];
    const deviation = ((latest - ma200) / ma200) * 100;
    const score = linearScoreInverse(deviation, -10, 25);
    indicators.push({
      name: '金价200MA偏离',
      value: deviation.toFixed(1),
      unit: '%',
      score,
      weight: 0.40,
      signal: deviation < -10 ? '严重超卖' : deviation < 0 ? '偏低' : deviation < 10 ? '正常' : deviation < 20 ? '偏高' : '严重过热'
    });
  }

  // 2. 金银比 (权重30%)
  if (goldCloses.length > 0 && data.silverPrices && data.silverPrices.length > 0) {
    const latestGold = goldCloses[goldCloses.length - 1];
    const latestSilver = data.silverPrices[data.silverPrices.length - 1].close;
    const ratio = latestGold / latestSilver;
    // 金银比低=金便宜(高分买入), 高=金贵(低分)
    const score = linearScoreInverse(ratio, 60, 90);
    indicators.push({
      name: '金银比',
      value: ratio.toFixed(1),
      unit: '',
      score,
      weight: 0.30,
      signal: ratio < 65 ? '金偏低估' : ratio < 75 ? '正常区间' : ratio < 85 ? '金偏高估' : '金严重高估'
    });
  }

  // 3. 金价趋势(5/30MA) (权重30%)
  if (goldCloses.length >= 30) {
    const ma5 = simpleMA(goldCloses, 5);
    const ma30 = simpleMA(goldCloses, 30);
    const trend = ((ma5 - ma30) / ma30) * 100;
    // 弱势(负)=回调买入(高分), 强势(正)=已经涨了(低分)
    const score = linearScoreInverse(trend, -8, 8);
    indicators.push({
      name: '金价趋势(5/30MA)',
      value: trend.toFixed(1),
      unit: '%',
      score,
      weight: 0.30,
      signal: trend < -5 ? '弱势回调' : trend < -2 ? '偏弱' : trend < 2 ? '震荡' : trend < 5 ? '偏强' : '强势上涨'
    });
  }

  const totalScore = compositeScore(indicators);
  const signal = scoreSignal(totalScore);

  let history7d = [];
  if (goldCloses.length >= 7) {
    history7d = data.goldPrices.slice(-7).map(d => ({ date: d.date, close: d.close }));
  }

  // === Detail data ===
  const detail = {};

  if (data.goldPrices && data.goldPrices.length >= 30) {
    detail.kline30d = data.goldPrices.slice(-30).map(d => ({
      date: d.date, open: d.open, high: d.high, low: d.low, close: d.close
    }));
  }

  if (goldCloses.length >= 60) {
    const dates = data.goldPrices.map(d => d.date);
    const last30Dates = dates.slice(-30);
    detail.ma = {
      ma5: rollingMA(goldCloses, dates, 5).filter(m => last30Dates.includes(m.date)),
      ma20: rollingMA(goldCloses, dates, 20).filter(m => last30Dates.includes(m.date)),
      ma60: rollingMA(goldCloses, dates, 60).filter(m => last30Dates.includes(m.date))
    };
  }

  // Aux chart: gold-silver ratio 90-day trend
  if (data.goldPrices && data.silverPrices && data.goldPrices.length >= 30 && data.silverPrices.length >= 30) {
    const goldLast90 = data.goldPrices.slice(-90);
    const silverMap = {};
    for (const s of data.silverPrices) silverMap[s.date] = s.close;
    const ratioData = [];
    for (const g of goldLast90) {
      if (silverMap[g.date] && silverMap[g.date] > 0) {
        ratioData.push({ date: g.date.slice(5), value: +(g.close / silverMap[g.date]).toFixed(1) });
      }
    }
    if (ratioData.length > 0) {
      detail.auxChart = {
        type: 'line',
        title: '金银比走势 (近90日)',
        unit: '',
        data: ratioData
      };
    }
  }

  // Narrative
  const narParts = [];
  for (const ind of indicators) {
    if (ind.name === '金价200MA偏离') {
      narParts.push(`金价偏离200日均线${ind.value}%，${ind.signal}。${parseFloat(ind.value) < -5 ? '金价回调至均线下方，历史上是较好的买入区间。' : parseFloat(ind.value) > 15 ? '金价大幅偏离均线，短期追高风险较大。' : ''}`);
    } else if (ind.name === '金银比') {
      const v = parseFloat(ind.value);
      narParts.push(`金银比为${ind.value}，${ind.signal}。${v > 80 ? '金银比偏高，金价相对银价偏贵，白银可能是更好的替代选择。' : v < 70 ? '金银比合理偏低，金价相对银价处于合理区间。' : ''}`);
    } else if (ind.name.includes('趋势')) {
      narParts.push(`短期趋势指标(5/30MA)为${ind.value}%，${ind.signal}。`);
    }
  }
  if (totalScore != null) {
    if (totalScore >= 70) narParts.push('综合来看，黄金多项指标偏向抄底，可考虑配置。');
    else if (totalScore >= 50) narParts.push('综合来看，黄金估值中性，作为避险资产可保持底仓。');
    else narParts.push('综合来看，黄金短期偏热，建议观望或等待回调。');
  }
  detail.narrative = narParts.join('\n');

  return {
    name: '黄金',
    id: 'gold',
    subtitle: 'COMEX黄金',
    score: totalScore,
    signal,
    indicators,
    history7d,
    price: goldCloses.length > 0 ? goldCloses[goldCloses.length - 1] : null,
    detail
  };
}

module.exports = { analyzeGold };
