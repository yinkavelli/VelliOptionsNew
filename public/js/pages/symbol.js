// ===== SYMBOL DETAIL PAGE =====

import { MarketAPI, OptionsAPI, AlphaVantageAPI } from '../api.js';
import { getState, setState } from '../state.js';
import { showError } from '../components/toast.js';
import { skeletonChart, skeletonTable } from '../components/skeleton.js';
import {
  formatCurrency, formatCompact, formatPercent, formatChange,
  formatVolume, changeClass, formatDate, formatDateShort,
  daysToExpiration, formatGreek, formatIV
} from '../utils/formatters.js';
import { navigate } from '../router.js';
import { analyzeOptions, generateExplainer, GREEK_TOOLTIPS } from '../utils/calculations.js';

let chartInstance = null;

// ===== PAYOFF DIAGRAM RENDERER (Interactive) =====
function drawPayoffDiagram(canvasId, payoffPoints, strategy) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !payoffPoints || payoffPoints.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);
  canvas.style.cursor = 'crosshair';

  // Layout constants
  const pad = { top: 24, right: 20, bottom: 40, left: 60 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  // Data ranges
  const prices = payoffPoints.map(p => p.price);
  const pnls = payoffPoints.map(p => p.pnl);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const pnlRange = Math.max(Math.abs(Math.min(...pnls)), Math.abs(Math.max(...pnls))) * 1.15;

  const xScale = (p) => pad.left + ((p - minPrice) / (maxPrice - minPrice)) * plotW;
  const yScale = (pnl) => pad.top + plotH / 2 - (pnl / pnlRange) * (plotH / 2);
  const xInverse = (px) => minPrice + ((px - pad.left) / plotW) * (maxPrice - minPrice);

  // Find closest payoff point to a price
  function getPnlAtPrice(targetPrice) {
    for (let i = 1; i < payoffPoints.length; i++) {
      if (payoffPoints[i].price >= targetPrice) {
        const prev = payoffPoints[i - 1];
        const curr = payoffPoints[i];
        const t = (targetPrice - prev.price) / (curr.price - prev.price);
        return prev.pnl + t * (curr.pnl - prev.pnl);
      }
    }
    return payoffPoints[payoffPoints.length - 1].pnl;
  }

  // ---- Draw base chart ----
  function drawBase() {
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
    ctx.fillRect(pad.left, pad.top, plotW, plotH);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = pad.top + (plotH / 6) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + plotW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Profit fill (green)
    ctx.beginPath();
    ctx.moveTo(xScale(prices[0]), zeroY);
    for (const pt of payoffPoints) {
      ctx.lineTo(xScale(pt.price), pt.pnl > 0 ? yScale(pt.pnl) : zeroY);
    }
    ctx.lineTo(xScale(prices[prices.length - 1]), zeroY);
    ctx.closePath();
    const profitGrad = ctx.createLinearGradient(0, pad.top, 0, zeroY);
    profitGrad.addColorStop(0, 'rgba(0, 200, 83, 0.35)');
    profitGrad.addColorStop(1, 'rgba(0, 200, 83, 0.02)');
    ctx.fillStyle = profitGrad;
    ctx.fill();

    // Loss fill (red)
    ctx.beginPath();
    ctx.moveTo(xScale(prices[0]), zeroY);
    for (const pt of payoffPoints) {
      ctx.lineTo(xScale(pt.price), pt.pnl < 0 ? yScale(pt.pnl) : zeroY);
    }
    ctx.lineTo(xScale(prices[prices.length - 1]), zeroY);
    ctx.closePath();
    const lossGrad = ctx.createLinearGradient(0, zeroY, 0, pad.top + plotH);
    lossGrad.addColorStop(0, 'rgba(255, 68, 68, 0.02)');
    lossGrad.addColorStop(1, 'rgba(255, 68, 68, 0.30)');
    ctx.fillStyle = lossGrad;
    ctx.fill();

    // P&L line
    ctx.beginPath();
    ctx.strokeStyle = '#d4a017';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    payoffPoints.forEach((pt, i) => {
      const x = xScale(pt.price);
      const y = yScale(pt.pnl);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Breakeven markers
    const breakevenPts = [];
    for (let i = 1; i < payoffPoints.length; i++) {
      const prev = payoffPoints[i - 1], curr = payoffPoints[i];
      if ((prev.pnl >= 0 && curr.pnl < 0) || (prev.pnl <= 0 && curr.pnl > 0)) {
        const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        breakevenPts.push(prev.price + ratio * (curr.price - prev.price));
      }
    }
    breakevenPts.forEach(bp => {
      const x = xScale(bp);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px SF Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BE: $' + bp.toFixed(0), x, pad.top + plotH + 28);
    });

    // Current price marker
    const currentPrice = strategy.legs?.[0]?.underlyingPrice;
    if (currentPrice && currentPrice >= minPrice && currentPrice <= maxPrice) {
      const cpx = xScale(currentPrice);
      ctx.strokeStyle = 'rgba(212, 160, 23, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(cpx, pad.top);
      ctx.lineTo(cpx, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d4a017';
      ctx.font = '10px SF Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$' + currentPrice.toFixed(0), cpx, pad.top - 6);
    }

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px SF Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = -4; i <= 4; i++) {
      const pnlVal = (i / 4) * pnlRange;
      const y = yScale(pnlVal);
      if (y >= pad.top && y <= pad.top + plotH) {
        ctx.fillText((pnlVal >= 0 ? '+$' : '-$') + Math.abs(pnlVal).toFixed(0), pad.left - 8, y + 4);
      }
    }

    // X-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + ((maxPrice - minPrice) / 5) * i;
      ctx.fillText('$' + price.toFixed(0), xScale(price), pad.top + plotH + 15);
    }
  }

  // Draw the base chart and cache it
  drawBase();
  const baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // ---- Draw crosshair overlay ----
  function drawCrosshair(mouseX) {
    // Restore base image (putImageData resets transform to identity)
    ctx.putImageData(baseImage, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // absolute transform, not cumulative

    // Clamp to plot area
    const clampedX = Math.max(pad.left, Math.min(mouseX, pad.left + plotW));
    const hoverPrice = xInverse(clampedX);
    const hoverPnl = getPnlAtPrice(hoverPrice);
    const snapY = yScale(hoverPnl);

    // Vertical crosshair line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(clampedX, pad.top);
    ctx.lineTo(clampedX, pad.top + plotH);
    ctx.stroke();

    // Horizontal crosshair line
    ctx.beginPath();
    ctx.moveTo(pad.left, snapY);
    ctx.lineTo(pad.left + plotW, snapY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot on the curve
    const dotColor = hoverPnl >= 0 ? '#00c853' : '#ff4444';
    ctx.beginPath();
    ctx.arc(clampedX, snapY, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tooltip
    const tooltipW = 155;
    const tooltipH = 54;
    let tooltipX = clampedX + 16;
    let tooltipY = snapY - tooltipH - 12;
    // Keep tooltip fully inside canvas bounds
    if (tooltipX + tooltipW > w - 5) tooltipX = clampedX - tooltipW - 16;
    if (tooltipX < 5) tooltipX = 5;
    if (tooltipY < 5) tooltipY = snapY + 16;
    if (tooltipY + tooltipH > h - 5) tooltipY = h - tooltipH - 5;

    // Tooltip background with rounded corners
    ctx.save();
    ctx.fillStyle = 'rgba(15, 15, 25, 0.95)';
    ctx.strokeStyle = 'rgba(212, 160, 23, 0.7)';
    ctx.lineWidth = 1.5;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(tooltipX + r, tooltipY);
    ctx.lineTo(tooltipX + tooltipW - r, tooltipY);
    ctx.quadraticCurveTo(tooltipX + tooltipW, tooltipY, tooltipX + tooltipW, tooltipY + r);
    ctx.lineTo(tooltipX + tooltipW, tooltipY + tooltipH - r);
    ctx.quadraticCurveTo(tooltipX + tooltipW, tooltipY + tooltipH, tooltipX + tooltipW - r, tooltipY + tooltipH);
    ctx.lineTo(tooltipX + r, tooltipY + tooltipH);
    ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipH, tooltipX, tooltipY + tooltipH - r);
    ctx.lineTo(tooltipX, tooltipY + r);
    ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + r, tooltipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Price row
    const priceStr = '$' + hoverPrice.toFixed(2);
    const pnlSign = hoverPnl >= 0 ? '+' : '';
    const pnlStr = pnlSign + '$' + hoverPnl.toFixed(2);

    ctx.font = '11px SF Mono, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Price', tooltipX + 10, tooltipY + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px SF Mono, SFMono-Regular, Consolas, monospace';
    ctx.fillText(priceStr, tooltipX + tooltipW - 10, tooltipY + 20);

    // P&L row
    ctx.font = '11px SF Mono, SFMono-Regular, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('P/L', tooltipX + 10, tooltipY + 40);
    ctx.textAlign = 'right';
    ctx.fillStyle = dotColor;
    ctx.font = 'bold 12px SF Mono, SFMono-Regular, Consolas, monospace';
    ctx.fillText(pnlStr, tooltipX + tooltipW - 10, tooltipY + 40);

    // X-axis price label (at cursor)
    ctx.fillStyle = 'rgba(212, 160, 23, 0.9)';
    ctx.font = 'bold 10px SF Mono, monospace';
    ctx.textAlign = 'center';
    const priceTagW = 52;
    const priceTagH = 16;
    const priceTagX = clampedX - priceTagW / 2;
    const priceTagY = pad.top + plotH + 1;
    ctx.fillStyle = 'rgba(212, 160, 23, 0.15)';
    ctx.fillRect(priceTagX, priceTagY, priceTagW, priceTagH);
    ctx.strokeStyle = 'rgba(212, 160, 23, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(priceTagX, priceTagY, priceTagW, priceTagH);
    ctx.fillStyle = '#d4a017';
    ctx.fillText('$' + hoverPrice.toFixed(0), clampedX, priceTagY + 12);

    // Y-axis P&L label (at cursor)
    const pnlTagW = 54;
    const pnlTagH = 16;
    const pnlTagX = pad.left - pnlTagW - 4;
    const pnlTagY = snapY - pnlTagH / 2;
    ctx.fillStyle = hoverPnl >= 0 ? 'rgba(0, 200, 83, 0.12)' : 'rgba(255, 68, 68, 0.12)';
    ctx.fillRect(pnlTagX, pnlTagY, pnlTagW, pnlTagH);
    ctx.strokeStyle = hoverPnl >= 0 ? 'rgba(0, 200, 83, 0.4)' : 'rgba(255, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pnlTagX, pnlTagY, pnlTagW, pnlTagH);
    ctx.fillStyle = dotColor;
    ctx.font = 'bold 9px SF Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pnlSign + '$' + Math.abs(hoverPnl).toFixed(0), pnlTagX + pnlTagW / 2, pnlTagY + 12);
  }

  // ---- Event handlers ----
  function getMouseX(e) {
    const canvasRect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - canvasRect.left;
  }

  // Remove old listeners if any
  canvas._payoffHandlers?.forEach(({ type, fn }) => canvas.removeEventListener(type, fn));
  const handlers = [];

  const onMove = (e) => {
    const mouseX = getMouseX(e);
    if (mouseX >= pad.left && mouseX <= pad.left + plotW) {
      e.preventDefault();
      drawCrosshair(mouseX);
    }
  };
  const onLeave = () => {
    ctx.putImageData(baseImage, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('touchend', onLeave);
  handlers.push({ type: 'mousemove', fn: onMove });
  handlers.push({ type: 'touchmove', fn: onMove });
  handlers.push({ type: 'mouseleave', fn: onLeave });
  handlers.push({ type: 'touchend', fn: onLeave });
  canvas._payoffHandlers = handlers;
}

export function renderSymbolPage(params) {
  const ticker = params.ticker?.toUpperCase();
  if (!ticker) return navigate('/');

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page container">
      <!-- Back Nav -->
      <div style="padding: var(--space-3) 0;">
        <button class="btn-ghost" id="back-btn" style="gap:4px;padding:0;height:auto;color:var(--text-secondary);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Market
        </button>
      </div>

      <!-- Stock Header -->
      <section class="glass-card section" id="stock-header">
        <div class="skeleton skeleton-heading"></div>
        <div class="skeleton skeleton-text wide"></div>
      </section>

      <!-- Chart -->
      <section class="glass-card chart-card section" id="chart-section">
        <div class="chart-container" id="chart-container">
          ${skeletonChart()}
        </div>
        <div class="chart-timeframes" id="chart-timeframes">
          ${['1D', '5D', '1M', '3M', '6M', '1Y'].map((r, i) =>
    `<button class="chart-timeframe ${i === 0 ? 'active' : ''}" data-range="${r.toLowerCase()}">${r}</button>`
  ).join('')}
        </div>
      </section>

      <!-- Company Fundamentals (Alpha Vantage) -->
      <section class="glass-card accordion section" id="fundamentals-section">
        <button class="accordion__header">
          <span style="display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            Company Fundamentals
          </span>
          <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="accordion__body">
          <div class="accordion__content" id="fundamentals-content">
            <div class="skeleton skeleton-text wide"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
      </section>

      <!-- Earnings Intel (Alpha Vantage) -->
      <section class="glass-card accordion section" id="earnings-section">
        <button class="accordion__header">
          <span style="display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Earnings Intel
          </span>
          <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="accordion__body">
          <div class="accordion__content" id="earnings-content">
            <div class="skeleton skeleton-text wide"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
      </section>

      <!-- News & Sentiment (Alpha Vantage) -->
      <section class="glass-card accordion section" id="news-section">
        <button class="accordion__header">
          <span style="display:flex;align-items:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
            News & Sentiment
          </span>
          <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="accordion__body">
          <div class="accordion__content" id="news-content">
            <div class="skeleton skeleton-text wide"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        </div>
      </section>

      <!-- Key Stats -->
      <section class="glass-card accordion open section" id="stats-section">
        <button class="accordion__header">
          Key Statistics
          <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="accordion__body">
          <div class="accordion__content">
            <div class="key-stats-grid" id="key-stats-grid">
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Options Chain -->
      <section class="glass-card accordion open section" id="options-section">
        <button class="accordion__header">
          Options Chain
          <svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="accordion__body">
          <div class="accordion__content">
            <div class="expiration-selector scroll-x" id="expiration-dates"></div>
            <div class="tabs" id="option-type-tabs" style="margin: var(--space-3) 0;">
              <button class="tab active" data-type="call">Calls</button>
              <button class="tab" data-type="put">Puts</button>
            </div>
            <div class="options-table-wrapper">
              <table class="options-table" id="options-table">
                <thead>
                  <tr>
                    <th>Strike</th><th>Bid</th><th>Ask</th><th>Last</th>
                    <th>Vol</th><th>OI</th><th>IV</th><th>Delta</th>
                  </tr>
                </thead>
                <tbody id="options-tbody">
                  ${skeletonTable(6)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Strategy Recommendations (appears after analysis) -->
      <section id="strategy-section" class="section hidden"></section>
    </div>
  `;

  // Event handlers
  document.getElementById('back-btn')?.addEventListener('click', () => navigate('/'));
  setupAccordions();
  setupChartTimeframes(ticker);
  setupOptionTypeTabs(ticker);

  // Load data
  loadQuote(ticker);
  loadChart(ticker, '1d');
  loadOptionsChain(ticker);

  // Alpha Vantage data (non-blocking, loads in parallel)
  loadFundamentals(ticker);
  loadEarnings(ticker);
  loadNews(ticker);

  return () => {
    if (chartInstance) { chartInstance.remove(); chartInstance = null; }
  };
}

function setupAccordions() {
  document.querySelectorAll('.accordion__header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });
}

function setupChartTimeframes(ticker) {
  const container = document.getElementById('chart-timeframes');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.chart-timeframe');
    if (!btn) return;
    container.querySelectorAll('.chart-timeframe').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadChart(ticker, btn.dataset.range);
  });
}

function setupOptionTypeTabs(ticker) {
  const tabs = document.getElementById('option-type-tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    setState({ selectedContractType: tab.dataset.type });
    renderOptionsTable();
  });
}

async function loadQuote(ticker) {
  try {
    const quote = await MarketAPI.getQuote(ticker);
    setState({ quote });

    const header = document.getElementById('stock-header');
    if (!header) return;

    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-1);">
        <span style="background:var(--accent-glow);color:var(--accent);padding:2px 8px;border-radius:var(--radius-full);font-size:0.75rem;font-weight:700;">${quote.symbol}</span>
        <span class="text-xs" style="color:var(--text-tertiary);">${quote.exchange || ''}</span>
      </div>
      <h1 style="font-size:1.25rem;margin-bottom:var(--space-2);">${quote.longName || quote.shortName}</h1>
      <div class="stock-detail__price-row">
        <span class="stock-detail__price">${formatCurrency(quote.price)}</span>
        <span class="stock-detail__change ${changeClass(quote.change)}">
          ${formatChange(quote.change)} (${formatPercent(quote.changePercent)})
        </span>
      </div>
      <div class="stock-detail__status">
        ${quote.marketState === 'REGULAR' ? '🟢 Market Open' :
        quote.marketState === 'PRE' ? '🟡 Pre-Market' :
          quote.marketState === 'POST' ? '🟡 After-Hours' : '🔴 Market Closed'}
      </div>
    `;

    // Populate Key Statistics
    const statsGrid = document.getElementById('key-stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
                <div class="key-stat"><span class="key-stat__label">Open</span><span class="key-stat__value">${formatCurrency(quote.open)}</span></div>
                <div class="key-stat"><span class="key-stat__label">Prev Close</span><span class="key-stat__value">${formatCurrency(quote.previousClose)}</span></div>
                <div class="key-stat"><span class="key-stat__label">Day High</span><span class="key-stat__value">${formatCurrency(quote.dayHigh)}</span></div>
                <div class="key-stat"><span class="key-stat__label">Day Low</span><span class="key-stat__value">${formatCurrency(quote.dayLow)}</span></div>
                <div class="key-stat"><span class="key-stat__label">Volume</span><span class="key-stat__value">${formatCompact(quote.volume)}</span></div>
                <div class="key-stat"><span class="key-stat__label">52W High</span><span class="key-stat__value">${formatCurrency(quote.fiftyTwoWeekHigh)}</span></div>
                <div class="key-stat"><span class="key-stat__label">52W Low</span><span class="key-stat__value">${formatCurrency(quote.fiftyTwoWeekLow)}</span></div>
                <div class="key-stat"><span class="key-stat__label">Exchange</span><span class="key-stat__value">${quote.exchange || '—'}</span></div>
            `;
    }
  } catch (err) {
    showError(`Failed to load quote for ${ticker}`);
  }
}

async function loadChart(ticker, range) {
  const container = document.getElementById('chart-container');
  if (!container) return;

  if (chartInstance) { chartInstance.remove(); chartInstance = null; }
  container.innerHTML = skeletonChart();

  try {
    const data = await MarketAPI.getChart(ticker, range);
    if (!data.points || data.points.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No chart data</p></div>';
      return;
    }

    container.innerHTML = '';

    // Use lightweight-charts if available, else canvas fallback
    if (window.LightweightCharts) {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDark = theme === 'dark';

      chartInstance = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor: isDark ? 'rgba(240,240,245,0.6)' : '#6B7280',
          fontSize: 11,
          fontFamily: "'Inter', sans-serif"
        },
        grid: {
          vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
          horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }
        },
        crosshair: { mode: 0 },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: range === '1d', secondsVisible: false },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
      });

      const isIntraday = range === '1d' || range === '5d';
      const formatPoint = (p) => {
        if (isIntraday) {
          return { time: p.time, open: p.open, high: p.high, low: p.low, close: p.close };
        }
        const d = new Date(p.time * 1000);
        return {
          time: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          open: p.open, high: p.high, low: p.low, close: p.close
        };
      };

      if (isIntraday) {
        const lineSeries = chartInstance.addLineSeries({
          color: data.points[data.points.length - 1].close >= (data.previousClose || data.points[0].open) ? '#10B981' : '#EF4444',
          lineWidth: 2,
          crosshairMarkerRadius: 4,
          priceLineVisible: false
        });
        lineSeries.setData(data.points.map(p => ({ time: p.time, value: p.close })));
      } else {
        const candleSeries = chartInstance.addCandlestickSeries({
          upColor: '#10B981',
          downColor: '#EF4444',
          borderDownColor: '#EF4444',
          borderUpColor: '#10B981',
          wickDownColor: '#EF4444',
          wickUpColor: '#10B981'
        });
        candleSeries.setData(data.points.map(formatPoint));
      }

      chartInstance.timeScale().fitContent();

      // Resize handler
      const observer = new ResizeObserver(() => {
        if (chartInstance) {
          chartInstance.applyOptions({ width: container.clientWidth });
        }
      });
      observer.observe(container);
    } else {
      // Canvas fallback
      renderCanvasChart(container, data);
    }
  } catch (err) {
    showError('Failed to load chart data');
    container.innerHTML = '<div class="empty-state"><p>Chart unavailable</p></div>';
  }
}

function renderCanvasChart(container, data) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const closes = data.points.map(p => p.close);
  const min = Math.min(...closes) * 0.998;
  const max = Math.max(...closes) * 1.002;
  const range = max - min || 1;
  const isPositive = closes[closes.length - 1] >= (data.previousClose || closes[0]);

  ctx.beginPath();
  ctx.strokeStyle = isPositive ? '#10B981' : '#EF4444';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  closes.forEach((val, i) => {
    const x = (i / (closes.length - 1)) * w;
    const y = h - ((val - min) / range) * (h * 0.85) - h * 0.05;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

async function loadOptionsChain(ticker) {
  try {
    const data = await OptionsAPI.getChain(ticker);
    setState({ optionsChain: data.results, selectedExpiration: data.expirations?.[0] || null });

    // Render expiration dates
    const expContainer = document.getElementById('expiration-dates');
    if (expContainer && data.expirations) {
      expContainer.innerHTML = data.expirations.slice(0, 12).map((exp, i) => `
        <button class="expiration-chip ${i === 0 ? 'active' : ''}" data-exp="${exp}">
          ${formatDateShort(exp)} <span class="text-xs" style="margin-left:4px;opacity:0.6;">${daysToExpiration(exp)}d</span>
        </button>
      `).join('');

      expContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.expiration-chip');
        if (!chip) return;
        expContainer.querySelectorAll('.expiration-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        setState({ selectedExpiration: chip.dataset.exp });
        renderOptionsTable();
      });
    }

    renderOptionsTable();
  } catch (err) {
    showError('Failed to load options chain');
    const tbody = document.getElementById('options-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-6);color:var(--text-secondary);">Options data unavailable for this symbol</td></tr>`;
  }
}

function renderOptionsTable() {
  const { optionsChain, selectedExpiration, selectedContractType, quote } = getState();
  const tbody = document.getElementById('options-tbody');
  if (!tbody) return;

  const filtered = optionsChain.filter(c => {
    if (selectedExpiration && c.expirationDate !== selectedExpiration) return false;
    if (c.contractType !== selectedContractType) return false;
    return true;
  }).sort((a, b) => a.strikePrice - b.strikePrice);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:var(--space-6);color:var(--text-secondary);">No ${selectedContractType} contracts for this expiration</td></tr>`;
    return;
  }

  const currentPrice = quote?.price || filtered[0]?.underlyingPrice || 0;

  let hasEstimatedQuotes = false;

  tbody.innerHTML = filtered.map(c => {
    const isITM = selectedContractType === 'call'
      ? c.strikePrice < currentPrice
      : c.strikePrice > currentPrice;
    const isATM = Math.abs(c.strikePrice - currentPrice) < (currentPrice * 0.01);

    if (c.quoteSource === 'estimated') hasEstimatedQuotes = true;
    const estMark = c.quoteSource === 'estimated' ? '<span style="opacity:0.5;font-size:0.75em;vertical-align:super;">E</span>' : '';

    return `
      <tr class="${isITM ? 'itm' : ''} ${isATM ? 'atm' : ''}" data-ticker="${c.ticker}" data-strike="${c.strikePrice}">
        <td style="font-weight:600;">${formatCurrency(c.strikePrice, 2)}</td>
        <td>${formatCurrency(c.bid, 2)}${estMark}</td>
        <td>${formatCurrency(c.ask, 2)}${estMark}</td>
        <td>${formatCurrency(c.lastPrice, 2)}</td>
        <td>${formatVolume(c.volume)}</td>
        <td>${formatCompact(c.openInterest)}</td>
        <td>${formatIV(c.impliedVolatility)}</td>
        <td>${formatGreek(c.greeks?.delta)}</td>
      </tr>
    `;
  }).join('');

  // Add explanatory note for estimated quotes
  let disclaimerRow = tbody.querySelector('.quote-disclaimer');
  if (hasEstimatedQuotes && !disclaimerRow) {
    tbody.insertAdjacentHTML('beforeend', `
       <tr class="quote-disclaimer">
         <td colspan="8" style="text-align:center;font-size:0.8rem;color:var(--text-secondary);padding:var(--space-4);">
           <span style="opacity:0.7;font-size:0.85em;vertical-align:super;">E</span> Prices are estimated based on last trade and volatility models (market closed/live quotes unavailable).
         </td>
       </tr>
    `);
  }

  // Add analyze button
  const stratSection = document.getElementById('strategy-section');
  if (stratSection && !document.getElementById('analyze-btn-container')) {
    const btnContainer = document.createElement('div');
    btnContainer.id = 'analyze-btn-container';
    btnContainer.style.cssText = 'padding: var(--space-4) 0;';
    btnContainer.innerHTML = `
      <button class="btn btn-primary w-full" id="analyze-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
        Analyze Options — Find Strategies
      </button>
    `;
    stratSection.before(btnContainer);

    document.getElementById('analyze-btn')?.addEventListener('click', () => {
      analyzeAndShowStrategies(getState().quote?.symbol);
    });
  }
}

// ===== ALPHA VANTAGE DATA LOADING =====

async function loadFundamentals(ticker) {
  const el = document.getElementById('fundamentals-content');
  if (!el) return;
  try {
    const d = await AlphaVantageAPI.getOverview(ticker);
    if (!d || !d.name) {
      el.innerHTML = '<p class="text-secondary text-sm">Fundamental data not available for this ticker.</p>';
      return;
    }

    const fmtPct = (v) => v !== null ? (v * 100).toFixed(2) + '%' : '—';
    const fmtNum = (v) => v !== null ? v.toFixed(2) : '—';
    const fmtBig = (v) => v !== null ? formatCompact(v) : '—';

    // Analyst consensus
    const totalAnalysts = (d.analystRatingBuy || 0) + (d.analystRatingHold || 0) + (d.analystRatingSell || 0);
    let consensusLabel = 'N/A';
    let consensusColor = 'var(--text-secondary)';
    if (totalAnalysts > 0) {
      const buyPct = d.analystRatingBuy / totalAnalysts;
      if (buyPct >= 0.6) { consensusLabel = 'Strong Buy'; consensusColor = '#10B981'; }
      else if (buyPct >= 0.4) { consensusLabel = 'Buy'; consensusColor = '#34D399'; }
      else if (d.analystRatingSell / totalAnalysts >= 0.4) { consensusLabel = 'Sell'; consensusColor = '#EF4444'; }
      else { consensusLabel = 'Hold'; consensusColor = '#F59E0B'; }
    }

    el.innerHTML = `
      ${d.description ? `<p class="text-secondary text-sm" style="margin-bottom:var(--space-4);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${d.description}</p>` : ''}
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-4);">
        ${d.sector ? `<span style="background:rgba(212,160,23,0.12);color:var(--accent);padding:3px 10px;border-radius:var(--radius-full);font-size:0.7rem;font-weight:600;">${d.sector}</span>` : ''}
        ${d.industry ? `<span style="background:rgba(255,255,255,0.06);color:var(--text-secondary);padding:3px 10px;border-radius:var(--radius-full);font-size:0.7rem;">${d.industry}</span>` : ''}
      </div>
      ${d.analystTargetPrice ? `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2);">
          <span class="text-secondary text-sm">Analyst Target</span>
          <span style="font-weight:700;color:${consensusColor};font-size:0.8rem;">${consensusLabel}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:var(--space-2);">
          <span style="font-size:1.5rem;font-weight:700;font-family:var(--font-mono);">${formatCurrency(d.analystTargetPrice)}</span>
          ${totalAnalysts > 0 ? `<span class="text-secondary text-xs">${totalAnalysts} analysts</span>` : ''}
        </div>
        ${totalAnalysts > 0 ? `
        <div style="display:flex;gap:2px;margin-top:var(--space-2);height:6px;border-radius:3px;overflow:hidden;">
          <div style="flex:${d.analystRatingBuy};background:#10B981;"></div>
          <div style="flex:${d.analystRatingHold};background:#F59E0B;"></div>
          <div style="flex:${d.analystRatingSell};background:#EF4444;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <span class="text-xs" style="color:#10B981;">Buy ${d.analystRatingBuy}</span>
          <span class="text-xs" style="color:#F59E0B;">Hold ${d.analystRatingHold}</span>
          <span class="text-xs" style="color:#EF4444;">Sell ${d.analystRatingSell}</span>
        </div>` : ''}
      </div>` : ''}
      <div class="key-stats-grid">
        <div class="key-stat"><span class="key-stat__label">P/E Ratio</span><span class="key-stat__value">${fmtNum(d.peRatio)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Forward P/E</span><span class="key-stat__value">${fmtNum(d.forwardPE)}</span></div>
        <div class="key-stat"><span class="key-stat__label">EPS</span><span class="key-stat__value">${fmtNum(d.eps)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Beta</span><span class="key-stat__value">${fmtNum(d.beta)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Profit Margin</span><span class="key-stat__value">${fmtPct(d.profitMargin)}</span></div>
        <div class="key-stat"><span class="key-stat__label">ROE</span><span class="key-stat__value">${fmtPct(d.returnOnEquity)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Revenue</span><span class="key-stat__value">${fmtBig(d.revenueTTM)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Div Yield</span><span class="key-stat__value">${d.dividendYield ? fmtPct(d.dividendYield) : '—'}</span></div>
        <div class="key-stat"><span class="key-stat__label">50D MA</span><span class="key-stat__value">${formatCurrency(d.fiftyDayMA)}</span></div>
        <div class="key-stat"><span class="key-stat__label">200D MA</span><span class="key-stat__value">${formatCurrency(d.twoHundredDayMA)}</span></div>
        <div class="key-stat"><span class="key-stat__label">Short Ratio</span><span class="key-stat__value">${fmtNum(d.shortRatio)}</span></div>
        <div class="key-stat"><span class="key-stat__label">PEG</span><span class="key-stat__value">${fmtNum(d.pegRatio)}</span></div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = '<p class="text-secondary text-sm">Fundamental data unavailable. Free tier may have hit rate limits.</p>';
  }
}

async function loadEarnings(ticker) {
  const el = document.getElementById('earnings-content');
  if (!el) return;
  try {
    const d = await AlphaVantageAPI.getEarnings(ticker);
    if (!d || !d.quarterly?.length) {
      el.innerHTML = '<p class="text-secondary text-sm">Earnings data not available for this ticker.</p>';
      return;
    }

    const { stats } = d;
    const beatPct = stats.total > 0 ? Math.round((stats.beats / stats.total) * 100) : 0;

    // Countdown
    let countdownHTML = '';
    if (d.nextEarningsDate) {
      const diff = Math.ceil((new Date(d.nextEarningsDate) - new Date()) / (1000 * 60 * 60 * 24));
      const urgency = diff <= 7 ? '#EF4444' : diff <= 14 ? '#F59E0B' : '#10B981';
      countdownHTML = `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-4);text-align:center;">
          <div class="text-secondary text-xs" style="margin-bottom:4px;">NEXT EARNINGS</div>
          <div style="font-size:2rem;font-weight:800;color:${urgency};font-family:var(--font-mono);">${diff}d</div>
          <div class="text-secondary text-xs">${new Date(d.nextEarningsDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>`;
    }

    // Beat/miss track record
    const trackHTML = `
      <div style="margin-bottom:var(--space-4);">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2);">
          <span class="text-secondary text-sm">Earnings Track Record</span>
          <span style="font-weight:600;color:${beatPct >= 70 ? '#10B981' : beatPct >= 50 ? '#F59E0B' : '#EF4444'};font-size:0.8rem;">${beatPct}% Beat Rate</span>
        </div>
        <div style="display:flex;gap:4px;">
          ${d.quarterly.slice(0, 8).map(q => {
      const color = q.surprise > 0 ? '#10B981' : q.surprise < 0 ? '#EF4444' : '#6B7280';
      const label = q.surprise > 0 ? '✓' : q.surprise < 0 ? '✗' : '—';
      return `<div style="flex:1;text-align:center;background:${color}22;border:1px solid ${color}44;border-radius:var(--radius-sm);padding:6px 2px;">
              <div style="font-size:0.7rem;font-weight:700;color:${color};">${label}</div>
              <div class="text-xs" style="color:var(--text-tertiary);margin-top:2px;">${q.date ? q.date.slice(5, 7) + '/' + q.date.slice(2, 4) : ''}</div>
            </div>`;
    }).join('')}
        </div>
        <div style="display:flex;gap:var(--space-3);margin-top:var(--space-2);justify-content:center;">
          <span class="text-xs" style="color:#10B981;">● Beat ${stats.beats}</span>
          <span class="text-xs" style="color:#EF4444;">● Miss ${stats.misses}</span>
          <span class="text-xs" style="color:#6B7280;">● Meet ${stats.meets}</span>
        </div>
      </div>`;

    // Quarterly table
    const tableHTML = `
      <div style="overflow-x:auto;">
        <table class="options-table" style="font-size:0.75rem;">
          <thead><tr><th>Quarter</th><th>EPS Est.</th><th>EPS Act.</th><th>Surprise</th></tr></thead>
          <tbody>
            ${d.quarterly.slice(0, 6).map(q => `
              <tr>
                <td>${q.date || '—'}</td>
                <td class="font-mono">${q.epsEstimate !== null ? '$' + q.epsEstimate.toFixed(2) : '—'}</td>
                <td class="font-mono" style="font-weight:600;">${q.epsActual !== null ? '$' + q.epsActual.toFixed(2) : '—'}</td>
                <td class="font-mono" style="color:${q.surprise > 0 ? '#10B981' : q.surprise < 0 ? '#EF4444' : 'var(--text-secondary)'};">
                  ${q.surprisePercent !== null ? (q.surprisePercent > 0 ? '+' : '') + q.surprisePercent.toFixed(1) + '%' : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    el.innerHTML = countdownHTML + trackHTML + tableHTML;
  } catch (err) {
    el.innerHTML = '<p class="text-secondary text-sm">Earnings data unavailable.</p>';
  }
}

async function loadNews(ticker) {
  const el = document.getElementById('news-content');
  if (!el) return;
  try {
    const d = await AlphaVantageAPI.getNews(ticker);
    if (!d || !d.articles?.length) {
      el.innerHTML = '<p class="text-secondary text-sm">No recent news for this ticker.</p>';
      return;
    }

    const { sentiment } = d;
    const sentColor = sentiment.label.includes('Bullish') ? '#10B981'
      : sentiment.label.includes('Bearish') ? '#EF4444' : '#F59E0B';

    // Sentiment gauge
    const gaugeHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-4);">
        <div style="text-align:center;min-width:80px;">
          <div style="font-size:1.5rem;font-weight:800;color:${sentColor};">${sentiment.label}</div>
          <div class="text-xs text-secondary">${sentiment.articlesAnalyzed} articles analyzed</div>
        </div>
        <div style="flex:1;">
          <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;position:relative;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${Math.max(5, Math.min(95, (sentiment.score + 0.5) * 100))}%;background:linear-gradient(90deg, #EF4444, #F59E0B, #10B981);border-radius:4px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;">
            <span class="text-xs" style="color:#EF4444;">Bearish</span>
            <span class="text-xs" style="color:#10B981;">Bullish</span>
          </div>
        </div>
      </div>`;

    // News cards
    const cardsHTML = d.articles.map(a => {
      const timeAgo = getTimeAgo(a.publishedAt);
      const aSentColor = a.tickerSentiment.includes('Bullish') ? '#10B981'
        : a.tickerSentiment.includes('Bearish') ? '#EF4444' : '#6B7280';

      return `
        <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="news-card" style="display:block;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:var(--radius-lg);padding:var(--space-3);margin-bottom:var(--space-2);text-decoration:none;color:inherit;transition:all 0.2s ease;">
          <div style="display:flex;justify-content:space-between;gap:var(--space-2);margin-bottom:4px;">
            <span class="text-xs" style="color:var(--text-tertiary);">${a.source}</span>
            <span class="text-xs" style="color:var(--text-tertiary);">${timeAgo}</span>
          </div>
          <div style="font-weight:600;font-size:0.8125rem;line-height:1.4;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${a.title}</div>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span style="width:6px;height:6px;border-radius:50%;background:${aSentColor};flex-shrink:0;"></span>
            <span class="text-xs" style="color:${aSentColor};">${a.tickerSentiment}</span>
            ${a.topics.length ? `<span class="text-xs text-secondary">· ${a.topics.join(', ')}</span>` : ''}
          </div>
        </a>`;
    }).join('');

    el.innerHTML = gaugeHTML + cardsHTML;
  } catch (err) {
    el.innerHTML = '<p class="text-secondary text-sm">News data unavailable.</p>';
  }
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  // AV format: 20240101T120000
  const y = dateStr.slice(0, 4), mo = dateStr.slice(4, 6), da = dateStr.slice(6, 8);
  const h = dateStr.slice(9, 11), mi = dateStr.slice(11, 13);
  const date = new Date(`${y}-${mo}-${da}T${h}:${mi}:00Z`);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function analyzeAndShowStrategies(ticker) {
  const section = document.getElementById('strategy-section');
  const btn = document.getElementById('analyze-btn');
  if (!section || !ticker) return;

  section.classList.remove('hidden');
  section.innerHTML = `
    <div class="section-header"><h2>Strategy Recommendations</h2></div>
    ${Array(3).fill(`<div class="glass-card" style="padding:var(--space-5);margin-bottom:var(--space-3);"><div class="skeleton skeleton-heading"></div><div class="skeleton skeleton-text wide"></div><div class="skeleton skeleton-text narrow"></div></div>`).join('')}
  `;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analyzing...';
  }

  try {
    // Strategy 1: Fetch expirations first, then get chain for the best monthly date
    const quote = getState().quote;
    const currentPrice = quote?.price || 0;

    // Focus on near-ATM strikes (±15% of current price)
    const strikeLow = Math.round(currentPrice * 0.85);
    const strikeHigh = Math.round(currentPrice * 1.15);

    // Find target expiration: 30-60 DTE monthly
    const minExpDate = new Date();
    minExpDate.setDate(minExpDate.getDate() + 30);
    const maxExpDate = new Date();
    maxExpDate.setDate(maxExpDate.getDate() + 60);
    const minDateStr = minExpDate.toISOString().split('T')[0];
    const maxDateStr = maxExpDate.toISOString().split('T')[0];

    // First request: get chain for 30-60 DTE with tight strike range
    const chainData = await OptionsAPI.getChain(ticker, {
      limit: 250,
      'expiration_date.gte': minDateStr,
      'expiration_date.lte': maxDateStr,
      'strike_price.gte': strikeLow,
      'strike_price.lte': strikeHigh,
      sort: 'strike_price'
    });
    const underlyingPrice = quote?.price || currentPrice || chainData.results[0]?.underlyingPrice || 0;

    const strategies = analyzeOptions(chainData.results, underlyingPrice);

    if (strategies.length === 0) {
      section.innerHTML = `
        <div class="section-header"><h2>Strategy Recommendations</h2></div>
        <div class="glass-card empty-state">
          <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p class="empty-state__title">No qualifying strategies found</p>
          <p class="empty-state__description">No strategies scored above 40/100 for ${ticker}. This could be due to low IV, wide bid-ask spreads, or limited option chain liquidity.</p>
        </div>
      `;
      return;
    }

    section.innerHTML = `
      <div class="section-header">
        <h2>Strategy Recommendations</h2>
        <span class="badge badge-accent">${strategies.length} found</span>
      </div>
      <div class="stagger" id="strategy-cards">
        ${strategies.map(s => renderStrategyCard(s)).join('')}
      </div>
    `;

    // Setup explainer toggles
    section.querySelectorAll('.explainer-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (target) {
          target.classList.toggle('hidden');
          btn.textContent = target.classList.contains('hidden') ? '▸ Why This Strategy?' : '▾ Hide Explainer';
        }
      });
    });

    // Store strategies for payoff diagram lookup
    const strategyMap = {};
    strategies.forEach(s => { strategyMap[s.id] = s; });

    // Setup payoff toggle buttons
    section.querySelectorAll('.payoff-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const payoffEl = document.getElementById(btn.dataset.payoffId);
        if (!payoffEl) return;

        payoffEl.classList.toggle('hidden');

        if (!payoffEl.classList.contains('hidden')) {
          btn.textContent = '📊 Hide Payoff';
          // Draw on next frame so canvas has layout dimensions
          const stratId = btn.dataset.strategyId;
          const strat = strategyMap[stratId];
          if (strat && strat.payoff) {
            requestAnimationFrame(() => {
              drawPayoffDiagram(btn.dataset.canvasId, strat.payoff, strat);
            });
          }
        } else {
          btn.textContent = '📊 Payoff';
        }
      });
    });

    // Setup tooltip toggles (mobile)
    section.querySelectorAll('.greek-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        badge.classList.toggle('active');
      });
    });

  } catch (err) {
    showError('Failed to analyze options');
    section.innerHTML = `
      <div class="section-header"><h2>Strategy Recommendations</h2></div>
      <div class="glass-card empty-state">
        <p class="empty-state__title">Analysis failed</p>
        <p class="empty-state__description">${err.message}</p>
      </div>`;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg> Analyze Options — Find Strategies`;
    }
  }
}

function renderStrategyCard(strategy) {
  const explainers = generateExplainer(strategy);
  const explainerId = `explainer-${strategy.id}`;
  const payoffId = `payoff-${strategy.id}`;

  const legsHtml = strategy.legs.map(l =>
    `<div>
      <div class="strategy-card__leg-label">${l.side === 'buy' ? 'Buy' : 'Sell'}</div>
      <div class="strategy-card__leg-value">${l.strikePrice} ${l.contractType.charAt(0).toUpperCase() + l.contractType.slice(1)}</div>
    </div>`
  ).join('');

  const greeksHtml = [
    { sym: 'Δ', key: 'delta', val: strategy.greeks?.delta },
    { sym: 'Θ', key: 'theta', val: strategy.greeks?.theta },
    { sym: 'Γ', key: 'gamma', val: strategy.greeks?.gamma },
    { sym: 'V', key: 'vega', val: strategy.greeks?.vega }
  ].map(g => {
    const tooltip = GREEK_TOOLTIPS[g.key] ? GREEK_TOOLTIPS[g.key](g.val || 0) : '';
    return `
      <div class="greek-badge tooltip-trigger">
        <span class="greek-badge__symbol">${g.sym}</span>
        <span class="greek-badge__value">${g.val !== undefined ? g.val.toFixed(3) : '—'}</span>
        ${tooltip ? `<div class="tooltip-content">${tooltip}</div>` : ''}
      </div>`;
  }).join('');

  const popClass = strategy.pop >= 65 ? 'high' : strategy.pop >= 40 ? 'medium' : 'low';

  return `
    <div class="glass-card strategy-card" style="margin-bottom: var(--space-3);">
      <div class="strategy-card__header">
        <span class="strategy-card__type">${strategy.name}</span>
        <span class="strategy-card__score">★ ${strategy.score}%</span>
      </div>
      <div class="strategy-card__subtitle">${strategy.subtitle}</div>

      <div class="strategy-card__legs">${legsHtml}</div>

      <div class="strategy-card__metrics">
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">Exp</span>
          <span class="strategy-card__metric-value">${formatDateShort(strategy.expiration)}</span>
        </div>
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">DTE</span>
          <span class="strategy-card__metric-value">${strategy.dte}d</span>
        </div>
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">${strategy.credit > 0 ? 'Credit' : 'Debit'}</span>
          <span class="strategy-card__metric-value text-positive">${formatCurrency(strategy.credit)}</span>
        </div>
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">Max Risk</span>
          <span class="strategy-card__metric-value text-negative">${formatCurrency(strategy.maxRisk)}</span>
        </div>
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">Max Profit</span>
          <span class="strategy-card__metric-value text-positive">${formatCurrency(strategy.maxProfit)}</span>
        </div>
        <div class="strategy-card__metric">
          <span class="strategy-card__metric-label">Breakeven</span>
          <span class="strategy-card__metric-value">${typeof strategy.breakeven === 'number' ? formatCurrency(strategy.breakeven) : strategy.breakeven}</span>
        </div>
      </div>

      <!-- Probability -->
      <div class="strategy-card__section-title">Probability Metrics</div>
      <div class="probability-bar" style="margin-bottom: var(--space-2);">
        <span class="strategy-card__metric-label">POP</span>
        <div class="probability-bar__track">
          <div class="probability-bar__fill ${popClass}" style="width: ${strategy.pop}%"></div>
        </div>
        <span class="probability-bar__label ${strategy.pop >= 60 ? 'text-positive' : strategy.pop >= 40 ? 'text-accent' : 'text-negative'}">${strategy.pop}%</span>
      </div>

      <!-- Greeks -->
      <div class="strategy-card__section-title">Greeks</div>
      <div class="strategy-card__greeks">${greeksHtml}</div>
      <div style="margin-top:var(--space-2);">
        <div class="greek-badge tooltip-trigger">
          <span class="greek-badge__symbol">IV</span>
          <span class="greek-badge__value">${strategy.iv ? (strategy.iv * 100).toFixed(1) + '%' : '—'}</span>
          <div class="tooltip-content">Implied Volatility reflects the market's expected move. ${strategy.iv ? (strategy.iv * 100).toFixed(1) : 0}% annualized means the market expects about ±${strategy.iv ? (strategy.iv / Math.sqrt(52) * 100).toFixed(1) : 0}% weekly moves.</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="strategy-card__actions">
        <button class="btn btn-secondary explainer-toggle" data-target="${explainerId}" style="flex:1;">▸ Why This Strategy?</button>
        <button class="btn btn-secondary payoff-toggle" data-payoff-id="${payoffId}" data-canvas-id="payoff-canvas-${strategy.id}" data-strategy-id="${strategy.id}" style="flex:1;">📊 Payoff</button>
      </div>

      <!-- Explainer (hidden by default) -->
      <div id="${explainerId}" class="hidden">
        ${explainers.map(e => `
          <div class="explainer">
            <div class="explainer__question">${e.question}</div>
            <div class="explainer__answer">${e.answer}</div>
          </div>
        `).join('')}
      </div>

      <!-- Payoff Diagram (hidden by default) -->
      <div id="${payoffId}" class="hidden" style="margin-top: var(--space-4);">
        <div class="strategy-card__section-title">Payoff at Expiration</div>
        <div class="payoff-container">
          <canvas id="payoff-canvas-${strategy.id}"></canvas>
        </div>
        <div class="payoff-labels">
          <div class="payoff-label">
            <div class="payoff-label__title">Max Profit</div>
            <div class="payoff-label__value text-positive">${formatCurrency(strategy.maxProfit * 100)}</div>
          </div>
          <div class="payoff-label">
            <div class="payoff-label__title">Max Loss</div>
            <div class="payoff-label__value text-negative">-${formatCurrency(strategy.maxRisk * 100)}</div>
          </div>
          <div class="payoff-label">
            <div class="payoff-label__title">Breakeven</div>
            <div class="payoff-label__value">${typeof strategy.breakeven === 'number' ? formatCurrency(strategy.breakeven) : strategy.breakeven}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
