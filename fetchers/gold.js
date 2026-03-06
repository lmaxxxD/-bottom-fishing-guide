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

async function fetchGold() {
  console.log('[黄金] 开始获取数据...');
  const result = {};

  // 1. COMEX金价K线(250天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=101.GC00Y&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.goldPrices = parseEastMoneyKlines(data);
    const latest = result.goldPrices[result.goldPrices.length - 1];
    console.log(`[黄金] 金价数据 ${result.goldPrices.length} 条, 最新=${latest?.close}`);
  } catch (e) {
    console.error('[黄金] 金价获取失败:', e.message);
  }

  // 2. COMEX银价K线(250天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=101.SI00Y&klt=101&fqt=0&lmt=250&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    result.silverPrices = parseEastMoneyKlines(data);
    const latest = result.silverPrices[result.silverPrices.length - 1];
    console.log(`[黄金] 银价数据 ${result.silverPrices.length} 条, 最新=${latest?.close}`);
  } catch (e) {
    console.error('[黄金] 银价获取失败:', e.message);
  }

  return result;
}

module.exports = { fetchGold };
