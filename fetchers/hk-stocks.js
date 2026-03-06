const { fetchJSONP, fetchJSON } = require('./common');

async function fetchHKStocks() {
  console.log('[港股] 开始获取数据...');
  const result = {};

  // 1. 恒指实时价格
  try {
    const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=100.HSI&fields=f43,f59,f169,f170&cb=cb';
    const data = await fetchJSONP(url);
    const d = data.data;
    const decimals = d.f59 || 2;
    result.price = d.f43 / Math.pow(10, decimals);
    result.changePercent = d.f170 / 100;
    console.log(`[港股] 恒指 价格=${result.price}, 涨跌=${result.changePercent}%`);
  } catch (e) {
    console.error('[港股] 实时数据获取失败:', e.message);
  }

  // 2. 恒指K线(500天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.HSI&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    const klines = data.data.klines || [];
    result.klines = klines.map(line => {
      const parts = line.split(',');
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
        amount: parseFloat(parts[6])
      };
    });
    console.log(`[港股] 恒指K线 ${result.klines.length} 条`);
  } catch (e) {
    console.error('[港股] K线数据获取失败:', e.message);
  }

  // 3. AH溢价指数K线
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=100.HSAHP&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
    const data = await fetchJSONP(url);
    const klines = data.data.klines || [];
    result.ahPremium = klines.map(line => {
      const parts = line.split(',');
      return { date: parts[0], close: parseFloat(parts[2]) };
    });
    const latest = result.ahPremium[result.ahPremium.length - 1];
    console.log(`[港股] AH溢价指数 ${result.ahPremium.length} 条, 最新=${latest?.close}`);
  } catch (e) {
    console.error('[港股] AH溢价指数获取失败:', e.message);
  }

  // 4. 南向资金(type 002 港股通沪 + type 004 港股通深)
  try {
    const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_DEAL_HISTORY&columns=MUTUAL_TYPE,TRADE_DATE,NET_DEAL_AMT,DEAL_AMT&pageSize=120&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB&filter=(MUTUAL_TYPE=%22006%22)';
    const data = await fetchJSON(url);
    if (data.result && data.result.data) {
      result.southboundData = data.result.data
        .filter(d => d.NET_DEAL_AMT != null)
        .map(d => ({
          date: d.TRADE_DATE,
          netBuy: d.NET_DEAL_AMT
        }));
      console.log(`[港股] 南向资金数据 ${result.southboundData.length} 条`);
    }
  } catch (e) {
    console.error('[港股] 南向资金数据获取失败:', e.message);
  }

  return result;
}

module.exports = { fetchHKStocks };
