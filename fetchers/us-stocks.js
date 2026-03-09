const { fetchJSONP, fetchJSON } = require('./common');

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

// Yahoo Finance fallback（境外服务器可访问）
async function fetchYahooKlines(symbol, limit = 500) {
  const range = limit > 365 ? '3y' : '2y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const data = await fetchJSON(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
  const res = data.chart?.result?.[0];
  if (!res) throw new Error('Yahoo Finance 返回空数据');
  const ts = res.timestamp || [];
  const q  = res.indicators?.quote?.[0] || {};
  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toISOString().split('T')[0],
    open:   q.open?.[i]   ?? null,
    close:  q.close?.[i]  ?? null,
    high:   q.high?.[i]   ?? null,
    low:    q.low?.[i]    ?? null,
    volume: q.volume?.[i] ?? null,
  })).filter(k => k.close != null).slice(-limit);
}

async function fetchUSStocks() {
  console.log('[美股] 开始获取数据...');
  const result = {};

  // 1. S&P500
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.SPX&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.sp500 = parseEastMoneyKlines(data);
    console.log(`[美股] S&P500数据 ${result.sp500.length} 条, 最新=${result.sp500.at(-1)?.close}`);
  } catch (e) {
    console.warn('[美股] S&P500 东方财富失败，切换Yahoo Finance:', e.message);
    try {
      result.sp500 = await fetchYahooKlines('^GSPC', 500);
      console.log(`[美股] S&P500数据(Yahoo) ${result.sp500.length} 条, 最新=${result.sp500.at(-1)?.close}`);
    } catch (e2) { console.error('[美股] S&P500 Yahoo也失败:', e2.message); }
  }

  // 2. VIX（优先真实VIX，VIXY作备选）
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=107.VIXY&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.vixy = parseEastMoneyKlines(data);
    console.log(`[美股] VIXY数据 ${result.vixy.length} 条, 最新=${result.vixy.at(-1)?.close}`);
  } catch (e) {
    console.warn('[美股] VIXY 东方财富失败，切换Yahoo Finance VIX:', e.message);
    try {
      result.vixy = await fetchYahooKlines('^VIX', 250);
      console.log(`[美股] VIX数据(Yahoo) ${result.vixy.length} 条, 最新=${result.vixy.at(-1)?.close}`);
    } catch (e2) { console.error('[美股] VIX Yahoo也失败:', e2.message); }
  }

  // 3. 纳斯达克100
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.NDX&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.nasdaq = parseEastMoneyKlines(data);
    console.log(`[美股] 纳指100数据 ${result.nasdaq.length} 条`);
  } catch (e) {
    console.warn('[美股] 纳指100 东方财富失败，切换Yahoo Finance:', e.message);
    try {
      result.nasdaq = await fetchYahooKlines('^NDX', 500);
      console.log(`[美股] 纳指100数据(Yahoo) ${result.nasdaq.length} 条`);
    } catch (e2) { console.error('[美股] 纳指100 Yahoo也失败:', e2.message); }
  }

  return result;
}

module.exports = { fetchUSStocks };
