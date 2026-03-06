const { fetchJSONP, fetchJSON } = require('./common');

async function fetchAShares() {
  console.log('[A股] 开始获取数据...');
  const result = {};

  // 1. 沪深300实时数据(价格/换手率)
  try {
    const url = 'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000300&fields=f43,f59,f168,f169,f170&cb=cb';
    const data = await fetchJSONP(url);
    const d = data.data;
    const decimals = d.f59 || 2;
    result.price = d.f43 / Math.pow(10, decimals);
    result.turnoverRate = d.f168 / 100;
    result.changePercent = d.f170 / 100;
    console.log(`[A股] 沪深300 价格=${result.price}, 换手率=${result.turnoverRate}%, 涨跌=${result.changePercent}%`);
  } catch (e) {
    console.error('[A股] 实时数据获取失败:', e.message);
  }

  // 2. 沪深300日K线(500天)
  try {
    const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000300&klt=101&fqt=0&lmt=500&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&cb=cb';
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
    console.log(`[A股] K线数据 ${result.klines.length} 条`);
  } catch (e) {
    console.error('[A股] K线数据获取失败:', e.message);
  }

  // 3. 北向+南向资金(总净买入，用type 006)
  try {
    const url = 'https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_MUTUAL_DEAL_HISTORY&columns=MUTUAL_TYPE,TRADE_DATE,NET_DEAL_AMT,DEAL_AMT&pageSize=120&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB&filter=(MUTUAL_TYPE=%22006%22)';
    const data = await fetchJSON(url);
    if (data.result && data.result.data) {
      // Type 006 = 南向总净流(invert it as proxy for northbound sentiment)
      result.crossBorderFlow = data.result.data
        .filter(d => d.NET_DEAL_AMT != null)
        .map(d => ({
          date: d.TRADE_DATE,
          netDeal: d.NET_DEAL_AMT, // 万元
          totalDeal: d.DEAL_AMT
        }));
      console.log(`[A股] 跨境资金数据 ${result.crossBorderFlow.length} 条`);
    }
  } catch (e) {
    console.error('[A股] 跨境资金数据获取失败:', e.message);
  }

  return result;
}

module.exports = { fetchAShares };
