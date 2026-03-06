/**
 * 通用评分引擎
 *
 * 每个指标配置格式:
 * {
 *   name: '指标名',
 *   value: 数值,
 *   score: 0-100分,
 *   weight: 权重(0-1),
 *   signal: '信号说明文字'
 * }
 */

/**
 * 计算加权综合评分
 * @param {Array} indicators - 指标数组 [{score, weight}, ...]
 * @returns {number} 0-100
 */
function compositeScore(indicators) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const ind of indicators) {
    if (ind.score != null && ind.weight) {
      weightedSum += ind.score * ind.weight;
      totalWeight += ind.weight;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

/**
 * 根据评分返回信号文字
 */
function scoreSignal(score) {
  if (score == null) return '数据缺失';
  if (score >= 80) return '强烈抄底';
  if (score >= 60) return '可以关注';
  if (score >= 40) return '中性观望';
  if (score >= 20) return '偏向高估';
  return '注意风险';
}

/**
 * 评分颜色
 */
function scoreColor(score) {
  if (score == null) return '#6b7280';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#86efac';
  if (score >= 40) return '#f97316';
  if (score >= 20) return '#ef4444';
  return '#991b1b';
}

module.exports = { compositeScore, scoreSignal, scoreColor };
