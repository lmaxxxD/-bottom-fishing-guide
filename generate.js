const fs = require('fs');
const path = require('path');

const { fetchAShares } = require('./fetchers/a-shares');
const { fetchHKStocks } = require('./fetchers/hk-stocks');
const { fetchUSStocks } = require('./fetchers/us-stocks');
const { fetchGold } = require('./fetchers/gold');
const { fetchBTC } = require('./fetchers/btc');

const { analyzeAShares } = require('./analyzers/a-shares');
const { analyzeHKStocks } = require('./analyzers/hk-stocks');
const { analyzeUSStocks } = require('./analyzers/us-stocks');
const { analyzeGold } = require('./analyzers/gold');
const { analyzeBTC } = require('./analyzers/btc');

const { renderHTML } = require('./render');

const OUTPUT_PATH = path.resolve('D:/各种赚钱指南/抄底指南.html');
const HISTORY_PATH = path.join(__dirname, 'history.json');

async function safeFetch(name, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[${name}] 获取失败:`, e.message);
    return {};
  }
}

async function main() {
  console.log('========================================');
  console.log('  抄底指南 — 五类资产抄底指标仪表盘');
  console.log('========================================\n');

  const startTime = Date.now();

  // Parallel fetch all data
  console.log('>>> 阶段1: 数据获取 (并行)\n');
  const [aSharesData, hkData, usData, goldData, btcData] = await Promise.all([
    safeFetch('A股', fetchAShares),
    safeFetch('港股', fetchHKStocks),
    safeFetch('美股', fetchUSStocks),
    safeFetch('黄金', fetchGold),
    safeFetch('BTC', fetchBTC)
  ]);

  // Analyze
  console.log('\n>>> 阶段2: 指标计算\n');
  const assets = [
    analyzeAShares(aSharesData),
    analyzeHKStocks(hkData),
    analyzeUSStocks(usData),
    analyzeGold(goldData),
    analyzeBTC(btcData)
  ];

  for (const a of assets) {
    console.log(`[${a.name}] 综合评分=${a.score ?? '—'} | ${a.signal} | 指标数=${a.indicators.length}`);
  }

  // Render HTML
  console.log('\n>>> 阶段3: 生成HTML\n');
  const generatedAt = new Date();
  const html = renderHTML(assets, generatedAt);

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  console.log(`HTML已生成: ${OUTPUT_PATH}`);

  // Also write index.html for GitHub Pages
  const indexPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`GitHub Pages入口已更新: ${indexPath}`);

  // Also save to output/ archive
  const archiveDir = path.join(__dirname, 'output');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  const archiveName = `抄底指南_${generatedAt.toISOString().split('T')[0]}.html`;
  fs.writeFileSync(path.join(archiveDir, archiveName), html, 'utf-8');

  // Update history.json
  try {
    let history = [];
    if (fs.existsSync(HISTORY_PATH)) {
      history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    }
    const snapshot = {
      date: generatedAt.toISOString().split('T')[0],
      timestamp: generatedAt.toISOString(),
      scores: {}
    };
    for (const a of assets) {
      snapshot.scores[a.name] = { score: a.score, signal: a.signal, price: a.price };
    }
    // Keep last 30 days, avoid duplicate dates
    history = history.filter(h => h.date !== snapshot.date);
    history.unshift(snapshot);
    history = history.slice(0, 30);
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`历史快照已更新: ${HISTORY_PATH}`);
  } catch (e) {
    console.error('历史快照更新失败:', e.message);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`  完成！用时 ${elapsed}s`);
  console.log(`  输出: ${OUTPUT_PATH}`);
  console.log(`========================================`);
}

main().catch(e => {
  console.error('致命错误:', e);
  process.exit(1);
});
