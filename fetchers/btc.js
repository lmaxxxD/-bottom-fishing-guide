const fs = require('fs');
const path = require('path');
const { fetchJSON } = require('./common');

async function fetchBTC() {
  console.log('[BTC] 开始获取数据...');
  const result = {};

  // Try reading from BTCTracker first
  const btcHistoryPath = path.join(__dirname, '..', '..', 'BTCTracker', 'btc-history.json');

  try {
    const raw = fs.readFileSync(btcHistoryPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.history && data.history.length > 0) {
      result.history = data.history;
      result.latest = data.history[0]; // Most recent entry
      console.log(`[BTC] 从BTCTracker读取 ${data.history.length} 条历史, 最新日期=${result.latest.date}, 价格=${result.latest.price}, 综合评分=${result.latest.compositeScore}`);
    }
  } catch (e) {
    console.warn('[BTC] BTCTracker数据读取失败:', e.message);
  }

  // Fallback price if no BTCTracker
  if (!result.latest) {
    try {
      console.log('[BTC] 使用备用数据源(CoinGecko)...');
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
      const data = await fetchJSON(url);
      result.latest = {
        date: new Date().toISOString().split('T')[0],
        price: data.bitcoin.usd,
        compositeScore: null,
        indicators: {}
      };
      console.log(`[BTC] 备用数据: 价格=${result.latest.price}`);
    } catch (e) {
      console.error('[BTC] CoinGecko也失败:', e.message);
    }
  }

  // Fetch BTC daily K-line from CryptoCompare (free, no auth, 全球可访问)
  try {
    const url = 'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=365';
    const data = await fetchJSON(url);
    const items = data.Data?.Data || [];
    result.klines = items.filter(d => d.open > 0).map(d => ({
      date: new Date(d.time * 1000).toISOString().split('T')[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volumefrom
    }));
    console.log(`[BTC] K线数据(CryptoCompare) ${result.klines.length} 条`);
  } catch (e) {
    console.warn('[BTC] K线获取失败:', e.message);
  }

  // 当 BTCTracker 本地文件不存在时（如 GitHub Actions），从 K 线构建 latest
  if (!result.latest && result.klines && result.klines.length > 0) {
    const klines = result.klines;
    const latestK = klines[klines.length - 1];
    const closes = klines.map(k => k.close);

    // 200日均线偏离度
    let ma200Dev = null;
    if (closes.length >= 200) {
      const ma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
      ma200Dev = (latestK.close - ma200) / ma200 * 100;
    }

    // 简化 RSI(14) 作为情绪代理
    let rsi14 = null;
    if (closes.length >= 15) {
      const diffs = closes.slice(-15).map((v, i, a) => i > 0 ? v - a[i - 1] : 0).slice(1);
      const gains = diffs.filter(d => d > 0).reduce((a, b) => a + b, 0) / 14;
      const losses = diffs.filter(d => d < 0).map(Math.abs).reduce((a, b) => a + b, 0) / 14;
      rsi14 = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
    }

    // 根据现有数据估算综合评分
    let score = 50;
    if (ma200Dev !== null) score += ma200Dev < -30 ? 25 : ma200Dev < -15 ? 15 : ma200Dev < 0 ? 5 : ma200Dev > 30 ? -15 : 0;
    if (rsi14 !== null)    score += rsi14 < 30 ? 20 : rsi14 < 45 ? 10 : rsi14 > 70 ? -15 : 0;
    score = Math.max(0, Math.min(100, Math.round(score)));

    result.latest = {
      date:           latestK.date,
      price:          latestK.close,
      compositeScore: score,
      indicators:     { ma200Dev, fearGreed: rsi14 != null ? Math.round(rsi14) : null },
    };
    console.log(`[BTC] 从K线构建latest: 价格=${latestK.close}, 评分=${score}, 200MA偏离=${ma200Dev?.toFixed(1)}%`);
  }

  return result;
}

module.exports = { fetchBTC };
