const { fetchJSONP, fetchJSON } = require('./common');

async function fetchYahooKlines(symbol, limit = 250) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
  const data = await fetchJSON(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
  const res = data.chart?.result?.[0];
  if (!res) throw new Error('Yahoo Finance 返回空数据');
  const ts = res.timestamp || [];
  const q  = res.indicators?.quote?.[0] || {};
  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toISOString().split('T')[0],
    open:   q.open?.[i]  ?? null,
    close:  q.close?.[i] ?? null,
    high:   q.high?.[i]  ?? null,
    low:    q.low?.[i]   ?? null,
    volume: q.volume?.[i]?? null,
  })).filter(k => k.close != null).slice(-limit);
}

function parseEastMoneyKlines(data) {
  const klines = data.data?.klines || [];
  return klines.map(line => {
    const parts = line.split(',');
    return {
      date: parts[0],
      open: parseFloat(parts[1]),
      close: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseFloat(parts[5])
    };
  });
}

async function fetchGold() {
  console.log('[黄金] 开始获取数据...');
  const result = {};

  // 1. COMEX金价
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=101.GC00Y&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.goldPrices = parseEastMoneyKlines(data);
    console.log(`[黄金] 金价数据 ${result.goldPrices.length} 条, 最新=${result.goldPrices.at(-1)?.close}`);
  } catch (e) {
    console.warn('[黄金] 金价 东方财富失败，切换Yahoo Finance:', e.message);
    try {
      result.goldPrices = await fetchYahooKlines('GC=F', 250);
      console.log(`[黄金] 金价数据(Yahoo) ${result.goldPrices.length} 条, 最新=${result.goldPrices.at(-1)?.close}`);
    } catch (e2) { console.error('[黄金] 金价 Yahoo也失败:', e2.message); }
  }

  // 2. COMEX银价
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=101.SI00Y&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.silverPrices = parseEastMoneyKlines(data);
    console.log(`[黄金] 银价数据 ${result.silverPrices.length} 条, 最新=${result.silverPrices.at(-1)?.close}`);
  } catch (e) {
    console.warn('[黄金] 银价 东方财富失败，切换Yahoo Finance:', e.message);
    try {
      result.silverPrices = await fetchYahooKlines('SI=F', 250);
      console.log(`[黄金] 银价数据(Yahoo) ${result.silverPrices.length} 条, 最新=${result.silverPrices.at(-1)?.close}`);
    } catch (e2) { console.error('[黄金] 银价 Yahoo也失败:', e2.message); }
  }

  return result;
}

module.exports = { fetchGold };
