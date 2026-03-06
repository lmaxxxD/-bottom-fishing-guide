const { scoreColor } = require('./analyzers/scoring');

let chartIdCounter = 0;

function nextId() { return `c${++chartIdCounter}`; }

// ========== Mini chart for overview cards ==========
function renderMiniChart(history7d) {
  if (!history7d || history7d.length < 2) return '';

  const gid = nextId();
  const values = history7d.map(d => d.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 140;
  const height = 40;
  const padding = 2;
  const stepX = (width - padding * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#22c55e' : '#ef4444';

  const areaPoints = points + ` ${(padding + (values.length - 1) * stepX).toFixed(1)},${height} ${padding},${height}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;margin:8px auto 0;">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0.05"/></linearGradient></defs>
    <polygon points="${areaPoints}" fill="url(#${gid})"/>
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

// ========== Overview card indicator rows ==========
function renderIndicatorRows(indicators) {
  return indicators.map(ind => {
    const color = scoreColor(ind.score);
    const barWidth = ind.score != null ? ind.score : 0;
    return `<tr>
      <td style="padding:4px 8px;color:#94a3b8;font-size:13px;white-space:nowrap;">${ind.name}</td>
      <td style="padding:4px 8px;color:#e2e8f0;font-size:13px;text-align:right;white-space:nowrap;">${ind.value}${ind.unit}</td>
      <td style="padding:4px 8px;width:80px;">
        <div style="background:#1e293b;border-radius:3px;height:8px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${barWidth}%;border-radius:3px;transition:width 0.3s;"></div>
        </div>
      </td>
      <td style="padding:4px 8px;color:${color};font-size:13px;font-weight:600;text-align:right;">${ind.score ?? '-'}</td>
      <td style="padding:4px 8px;color:#94a3b8;font-size:12px;">${ind.signal}</td>
    </tr>`;
  }).join('\n');
}

// ========== Overview card (clickable) ==========
function renderCard(asset) {
  const color = scoreColor(asset.score);
  const scoreDisplay = asset.score != null ? asset.score : '—';
  const priceDisplay = asset.price != null
    ? (asset.price > 10000 ? asset.price.toFixed(0) : asset.price.toFixed(2))
    : '—';

  return `<div onclick="showDetail('${asset.id}')" style="background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155;flex:1;min-width:280px;max-width:400px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='#60a5fa';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155';this.style.transform='none'">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
    <div>
      <div style="font-size:18px;font-weight:700;color:#f1f5f9;">${asset.name}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">${asset.subtitle} | ${priceDisplay}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:36px;font-weight:800;color:${color};line-height:1;">${scoreDisplay}</div>
      <div style="font-size:12px;color:${color};margin-top:2px;">${asset.signal}</div>
    </div>
  </div>
  ${asset.indicators.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;">
    <tbody>
      ${renderIndicatorRows(asset.indicators)}
    </tbody>
  </table>` : '<div style="color:#64748b;text-align:center;padding:16px;">数据缺失</div>'}
  ${renderMiniChart(asset.history7d)}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:0 4px;">
    <span style="font-size:10px;color:#475569;">${asset.history7d[0]?.date?.slice(5) || ''}</span>
    <span style="font-size:10px;color:#475569;">7日走势</span>
    <span style="font-size:10px;color:#475569;">${asset.history7d[asset.history7d.length - 1]?.date?.slice(5) || ''}</span>
  </div>
  <div style="text-align:center;margin-top:10px;color:#60a5fa;font-size:12px;">查看详情 →</div>
</div>`;
}

// ========== 30-day price chart with MA lines (SVG) ==========
function renderPriceChart(kline30d, maData) {
  if (!kline30d || kline30d.length < 2) return '<div style="color:#64748b;text-align:center;padding:20px;">K线数据不足</div>';

  const id = nextId();
  const W = 640, H = 220, PL = 60, PR = 20, PT = 20, PB = 40;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const closes = kline30d.map(d => d.close);
  const highs = kline30d.map(d => d.high || d.close);
  const lows = kline30d.map(d => d.low || d.close);

  // Collect all values for scale (including MAs)
  let allVals = [...highs, ...lows];
  if (maData) {
    for (const key of ['ma5', 'ma20', 'ma60']) {
      if (maData[key]) allVals.push(...maData[key].map(m => m.value));
    }
  }
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const rangeV = maxV - minV || 1;

  const toX = (i) => PL + (i / (kline30d.length - 1)) * chartW;
  const toY = (v) => PT + (1 - (v - minV) / rangeV) * chartH;

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block;max-width:${W}px;margin:0 auto;">`;

  // Grid lines (4 horizontal)
  for (let i = 0; i <= 4; i++) {
    const y = PT + (i / 4) * chartH;
    const val = maxV - (i / 4) * rangeV;
    svg += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
    svg += `<text x="${PL - 5}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="10">${val > 1000 ? val.toFixed(0) : val.toFixed(1)}</text>`;
  }

  // Candlestick bodies + wicks
  const barW = Math.max(2, Math.min(12, chartW / kline30d.length * 0.6));
  kline30d.forEach((d, i) => {
    const x = toX(i);
    const isUp = d.close >= d.open;
    const color = isUp ? '#22c55e' : '#ef4444';
    const bodyTop = toY(Math.max(d.open, d.close));
    const bodyBot = toY(Math.min(d.open, d.close));
    const bodyH = Math.max(1, bodyBot - bodyTop);
    // Wick
    if (d.high !== d.low) {
      svg += `<line x1="${x}" y1="${toY(d.high)}" x2="${x}" y2="${toY(d.low)}" stroke="${color}" stroke-width="1"/>`;
    }
    // Body
    svg += `<rect x="${x - barW / 2}" y="${bodyTop}" width="${barW}" height="${bodyH}" fill="${color}" rx="1"/>`;
  });

  // MA lines
  const maStyles = { ma5: '#3b82f6', ma20: '#f59e0b', ma60: '#a855f7' };
  if (maData) {
    for (const [key, color] of Object.entries(maStyles)) {
      if (!maData[key] || maData[key].length < 2) continue;
      const dateMap = {};
      kline30d.forEach((d, i) => { dateMap[d.date] = i; });
      const pts = maData[key]
        .filter(m => dateMap[m.date] !== undefined)
        .map(m => `${toX(dateMap[m.date]).toFixed(1)},${toY(m.value).toFixed(1)}`)
        .join(' ');
      if (pts) svg += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" opacity="0.8"/>`;
    }
  }

  // X-axis date labels (every 5 days)
  kline30d.forEach((d, i) => {
    if (i % 5 === 0 || i === kline30d.length - 1) {
      svg += `<text x="${toX(i)}" y="${H - 5}" text-anchor="middle" fill="#64748b" font-size="10">${d.date.slice(5)}</text>`;
    }
  });

  svg += '</svg>';

  // Legend
  svg += `<div style="display:flex;gap:16px;justify-content:center;margin-top:4px;font-size:11px;">
    <span style="color:#3b82f6;">── MA5</span>
    <span style="color:#f59e0b;">── MA20</span>
    <span style="color:#a855f7;">── MA60</span>
  </div>`;

  return svg;
}

// ========== Bar chart (fund flow etc.) ==========
function renderBarChart(auxData) {
  if (!auxData || !auxData.data || auxData.data.length < 2) return '';

  const W = 640, H = 150, PL = 50, PR = 20, PT = 10, PB = 35;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const values = auxData.data.map(d => d.value);
  const maxAbs = Math.max(Math.abs(Math.min(...values)), Math.abs(Math.max(...values))) || 1;
  const barW = Math.max(2, (chartW / auxData.data.length) * 0.7);
  const gap = chartW / auxData.data.length;

  const zeroY = PT + chartH / 2;

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block;max-width:${W}px;margin:0 auto;">`;

  // Zero line
  svg += `<line x1="${PL}" y1="${zeroY}" x2="${W - PR}" y2="${zeroY}" stroke="#475569" stroke-width="1"/>`;

  // Y-axis labels
  svg += `<text x="${PL - 5}" y="${PT + 4}" text-anchor="end" fill="#64748b" font-size="10">+${maxAbs.toFixed(0)}</text>`;
  svg += `<text x="${PL - 5}" y="${zeroY + 4}" text-anchor="end" fill="#64748b" font-size="10">0</text>`;
  svg += `<text x="${PL - 5}" y="${PT + chartH + 4}" text-anchor="end" fill="#64748b" font-size="10">-${maxAbs.toFixed(0)}</text>`;

  auxData.data.forEach((d, i) => {
    const x = PL + i * gap + gap / 2;
    const barH = (Math.abs(d.value) / maxAbs) * (chartH / 2);
    const color = d.value >= 0 ? '#22c55e' : '#ef4444';
    const y = d.value >= 0 ? zeroY - barH : zeroY;
    svg += `<rect x="${x - barW / 2}" y="${y}" width="${barW}" height="${Math.max(1, barH)}" fill="${color}" rx="1"/>`;

    // X-axis label (every 5)
    if (i % 5 === 0 || i === auxData.data.length - 1) {
      svg += `<text x="${x}" y="${H - 5}" text-anchor="middle" fill="#64748b" font-size="9">${d.date}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ========== Line chart (AH premium, VIXY, gold-silver ratio) ==========
function renderLineChart(auxData) {
  if (!auxData || !auxData.data || auxData.data.length < 2) return '';

  const W = 640, H = 180, PL = 50, PR = 20, PT = 15, PB = 35;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const values = auxData.data.map(d => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;

  const toX = (i) => PL + (i / (auxData.data.length - 1)) * chartW;
  const toY = (v) => PT + (1 - (v - minV) / rangeV) * chartH;

  const gid = nextId();

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="display:block;max-width:${W}px;margin:0 auto;">`;

  // Grid
  for (let i = 0; i <= 3; i++) {
    const y = PT + (i / 3) * chartH;
    const val = maxV - (i / 3) * rangeV;
    svg += `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="#1e293b" stroke-width="1"/>`;
    svg += `<text x="${PL - 5}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="10">${val.toFixed(1)}</text>`;
  }

  // Area gradient
  const points = auxData.data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ');
  const areaPoints = points + ` ${toX(auxData.data.length - 1).toFixed(1)},${PT + chartH} ${PL},${PT + chartH}`;
  svg += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa" stop-opacity="0.2"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0.02"/></linearGradient></defs>`;
  svg += `<polygon points="${areaPoints}" fill="url(#${gid})"/>`;
  svg += `<polyline points="${points}" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linejoin="round"/>`;

  // X-axis labels
  const step = Math.max(1, Math.floor(auxData.data.length / 8));
  auxData.data.forEach((d, i) => {
    if (i % step === 0 || i === auxData.data.length - 1) {
      svg += `<text x="${toX(i)}" y="${H - 5}" text-anchor="middle" fill="#64748b" font-size="9">${d.date}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ========== Radar chart for BTC ==========
function renderRadarChart(radarData) {
  if (!radarData || radarData.length < 3) return '';

  const SIZE = 250, CX = SIZE / 2, CY = SIZE / 2, R = 95;
  const n = radarData.length;
  const angleStep = (2 * Math.PI) / n;

  let svg = `<svg width="100%" viewBox="0 0 ${SIZE} ${SIZE}" style="display:block;max-width:${SIZE}px;margin:0 auto;">`;

  // Background rings
  for (let ring = 1; ring <= 4; ring++) {
    const r = (ring / 4) * R;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      pts.push(`${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`);
    }
    svg += `<polygon points="${pts.join(' ')}" fill="none" stroke="#1e293b" stroke-width="1"/>`;
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + i * angleStep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    svg += `<line x1="${CX}" y1="${CY}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#334155" stroke-width="1"/>`;
  }

  // Data polygon
  const gid = nextId();
  const dataPts = radarData.map((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (d.score / 100) * R;
    return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  svg += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e" stop-opacity="0.4"/><stop offset="100%" stop-color="#22c55e" stop-opacity="0.1"/></linearGradient></defs>`;
  svg += `<polygon points="${dataPts}" fill="url(#${gid})" stroke="#22c55e" stroke-width="2"/>`;

  // Data points
  radarData.forEach((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = (d.score / 100) * R;
    const x = CX + r * Math.cos(angle);
    const y = CY + r * Math.sin(angle);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#22c55e"/>`;
  });

  // Labels
  radarData.forEach((d, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const lr = R + 18;
    const x = CX + lr * Math.cos(angle);
    const y = CY + lr * Math.sin(angle);
    svg += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="#94a3b8" font-size="9">${d.name}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// ========== Indicator detail card ==========
function renderIndicatorCard(ind) {
  const color = scoreColor(ind.score);
  const barWidth = ind.score != null ? ind.score : 0;

  // Generate interpretation text
  let interp = ind.signal;
  if (ind.score != null) {
    if (ind.score >= 70) interp += ' — 该指标显示较强的买入信号';
    else if (ind.score >= 50) interp += ' — 该指标中性偏积极';
    else if (ind.score >= 30) interp += ' — 该指标偏向观望';
    else interp += ' — 该指标显示风险偏高';
  }

  return `<div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px;flex:1;min-width:180px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="color:#94a3b8;font-size:12px;font-weight:600;">${ind.name}</span>
      <span style="color:${color};font-size:20px;font-weight:800;">${ind.score ?? '-'}</span>
    </div>
    <div style="color:#e2e8f0;font-size:18px;font-weight:700;margin-bottom:6px;">${ind.value}${ind.unit}</div>
    <div style="background:#1e293b;border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px;">
      <div style="background:${color};height:100%;width:${barWidth}%;border-radius:4px;"></div>
    </div>
    <div style="color:#64748b;font-size:11px;line-height:1.5;">${interp}</div>
    <div style="color:#475569;font-size:10px;margin-top:4px;">权重: ${((ind.weight || 0) * 100).toFixed(0)}%</div>
  </div>`;
}

// ========== Aux chart dispatcher ==========
function renderAuxChart(asset) {
  const d = asset.detail;
  if (!d) return '';

  let html = '';

  // BTC radar chart
  if (d.radarChart) {
    html += `<div style="margin-top:20px;">
      <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:12px;">📊 指标雷达图</h3>
      ${renderRadarChart(d.radarChart)}
    </div>`;
  }

  // Aux chart (bar or line)
  if (d.auxChart) {
    html += `<div style="margin-top:20px;">
      <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:12px;">📈 ${d.auxChart.title}</h3>
      ${d.auxChart.type === 'bar' ? renderBarChart(d.auxChart) : renderLineChart(d.auxChart)}
    </div>`;
  }

  return html;
}

// ========== Detail page for one asset ==========
function renderDetailPage(asset) {
  const color = scoreColor(asset.score);
  const scoreDisplay = asset.score != null ? asset.score : '—';
  const d = asset.detail || {};

  // Price chart
  const priceChart = renderPriceChart(d.kline30d, d.ma);

  // Indicator cards
  const indCards = asset.indicators.map(renderIndicatorCard).join('\n');

  // Narrative
  const narrative = d.narrative
    ? d.narrative.split('\n').map(line => `<p style="margin:0 0 8px;color:#cbd5e1;font-size:14px;line-height:1.7;">${line}</p>`).join('')
    : '<p style="color:#64748b;">暂无分析</p>';

  // Aux charts
  const auxCharts = renderAuxChart(asset);

  return `<div id="detail-${asset.id}" class="detail-page" style="display:none;max-width:800px;margin:0 auto;">
  <!-- Top bar -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #1e293b;">
    <button onclick="showOverview()" style="background:none;border:1px solid #334155;color:#60a5fa;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;transition:all 0.2s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='none'">← 返回总览</button>
    <div style="text-align:right;">
      <span style="color:#f1f5f9;font-size:18px;font-weight:700;">${asset.name} · ${asset.subtitle}</span>
      <span style="color:${color};font-size:28px;font-weight:800;margin-left:16px;">${scoreDisplay}</span>
      <span style="color:${color};font-size:13px;margin-left:6px;">${asset.signal}</span>
    </div>
  </div>

  <!-- Price chart -->
  <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:12px;">📉 ${d.kline30d ? d.kline30d.length : 30}日价格走势</h3>
    ${priceChart}
  </div>

  <!-- Indicator cards -->
  <div style="margin-bottom:16px;">
    <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:12px;">🎯 指标详解</h3>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      ${indCards}
    </div>
  </div>

  <!-- Narrative -->
  <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <h3 style="color:#f1f5f9;font-size:16px;font-weight:700;margin-bottom:12px;">💡 综合研判</h3>
    ${narrative}
  </div>

  <!-- Aux charts -->
  ${auxCharts ? `<div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">${auxCharts}</div>` : ''}

  <!-- Back button bottom -->
  <div style="text-align:center;margin-top:16px;">
    <button onclick="showOverview()" style="background:#1e293b;border:1px solid #334155;color:#60a5fa;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;">← 返回总览</button>
  </div>
</div>`;
}

// ========== Main HTML ==========
function renderHTML(assets, generatedAt) {
  chartIdCounter = 0; // reset for each render
  const date = generatedAt.toISOString().split('T')[0];
  const time = generatedAt.toTimeString().split(' ')[0];

  // 跨资产共振检测
  const bullishCount = assets.filter(a => a.score != null && a.score >= 60).length;
  const resonanceBanner = bullishCount >= 3
    ? `<div style="background:linear-gradient(135deg,#065f46,#064e3b);border:1px solid #059669;border-radius:8px;padding:12px 20px;margin-bottom:20px;text-align:center;">
        <span style="font-size:16px;font-weight:700;color:#34d399;">跨资产共振信号</span>
        <span style="color:#a7f3d0;margin-left:12px;">${bullishCount} 个资产显示抄底机会，多市场共振确认</span>
      </div>`
    : '';

  const cards = assets.map(renderCard).join('\n');
  const detailPages = assets.map(renderDetailPage).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>抄底指南 | ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    padding: 20px;
    min-height: 100vh;
  }
  a { color: #60a5fa; text-decoration: none; }
  @media (max-width: 768px) {
    .card-grid { flex-direction: column !important; }
    .card-grid > div { max-width: 100% !important; }
    .detail-page { padding: 0 4px !important; }
  }
  .detail-page { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>

<div style="max-width:1400px;margin:0 auto;">
  <!-- Overview -->
  <div id="overview">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:28px;font-weight:800;color:#f8fafc;letter-spacing:1px;">抄底指南</h1>
      <div style="color:#64748b;font-size:14px;margin-top:4px;">${date} | 五类资产抄底信号仪表盘</div>
    </div>

    ${resonanceBanner}

    <!-- Cards -->
    <div class="card-grid" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;">
      ${cards}
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding:16px;border-top:1px solid #1e293b;">
      <div style="color:#475569;font-size:12px;line-height:1.8;">
        免责声明：本页面仅供个人学习参考，不构成任何投资建议。投资有风险，入市需谨慎。<br>
        数据来源：东方财富、Yahoo Finance、CBOE、CNN | 生成时间：${date} ${time}
      </div>
    </div>
  </div>

  <!-- Detail Pages -->
  ${detailPages}
</div>

<script>
function showDetail(id) {
  document.getElementById('overview').style.display = 'none';
  document.querySelectorAll('.detail-page').forEach(function(d) { d.style.display = 'none'; });
  var el = document.getElementById('detail-' + id);
  if (el) { el.style.display = 'block'; }
  window.scrollTo(0, 0);
}
function showOverview() {
  document.querySelectorAll('.detail-page').forEach(function(d) { d.style.display = 'none'; });
  document.getElementById('overview').style.display = 'block';
  window.scrollTo(0, 0);
}
</script>

</body>
</html>`;
}

module.exports = { renderHTML };
