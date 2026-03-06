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
      console.log('[BTC] 使用备用数据源...');
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
      console.error('[BTC] 备用数据获取也失败:', e.message);
    }
  }

  // Fetch BTC daily K-line from CryptoCompare (free, no auth)
  try {
    const url = 'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=90';
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

  return result;
}

module.exports = { fetchBTC };
