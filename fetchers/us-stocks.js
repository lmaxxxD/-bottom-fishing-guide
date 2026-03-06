const { fetchJSONP } = require('./common');

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

async function fetchUSStocks() {
  console.log('[美股] 开始获取数据...');
  const result = {};

  // 1. S&P500 K线(500天) from EastMoney
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.SPX&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.sp500 = parseEastMoneyKlines(data);
    const latest = result.sp500[result.sp500.length - 1];
    console.log(`[美股] S&P500数据 ${result.sp500.length} 条, 最新=${latest?.close}`);
  } catch (e) {
    console.error('[美股] S&P500数据获取失败:', e.message);
  }

  // 2. VIXY ETF as VIX proxy (250天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=107.VIXY&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.vixy = parseEastMoneyKlines(data);
    const latest = result.vixy[result.vixy.length - 1];
    console.log(`[美股] VIXY数据 ${result.vixy.length} 条, 最新=${latest?.close}`);
  } catch (e) {
    console.error('[美股] VIXY数据获取失败:', e.message);
  }

  // 3. 纳斯达克100 K线(500天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.NDX&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.nasdaq = parseEastMoneyKlines(data);
    console.log(`[美股] 纳指100数据 ${result.nasdaq.length} 条`);
  } catch (e) {
    console.error('[美股] 纳指100获取失败:', e.message);
  }

  return result;
}

module.exports = { fetchUSStocks };
