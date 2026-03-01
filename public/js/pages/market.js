// ===== MARKET HUB PAGE =====

import { MarketAPI } from '../api.js';
import { getState, setState, setLoading } from '../state.js';
import { showError } from '../components/toast.js';
import { skeletonStockCard } from '../components/skeleton.js';
import { formatCurrency, formatPercent, formatCompact, changeClass } from '../utils/formatters.js';
import { navigate } from '../router.js';

export function renderMarketPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="page container">
      <!-- Market Indices Strip -->
      <section class="index-strip section" id="index-strip">
        <div class="scroll-x" id="indices-scroll">
          ${Array(4).fill('<div class="index-chip skeleton" style="min-width:140px;height:64px;"></div>').join('')}
        </div>
      </section>

      <!-- Trending Tabs -->
      <section class="section">
        <div class="section-header">
          <h2>Market Movers</h2>
        </div>
        <div class="tabs" id="trending-tabs" style="margin-bottom: var(--space-4);">
          <button class="tab active" data-category="most_active">Most Active</button>
          <button class="tab" data-category="gainers">Top Gainers</button>
          <button class="tab" data-category="losers">Top Losers</button>
        </div>
        <div class="stock-grid stagger" id="stock-grid">
          ${skeletonStockCard(8)}
        </div>
      </section>
    </div>
  `;

    setupTrendingTabs();
    loadIndices();
    loadTrending('most_active');
}

function setupTrendingTabs() {
    const tabsEl = document.getElementById('trending-tabs');
    if (!tabsEl) return;
    tabsEl.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;
        tabsEl.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadTrending(tab.dataset.category);
    });
}

async function loadIndices() {
    try {
        const data = await MarketAPI.getIndices();
        const container = document.getElementById('indices-scroll');
        if (!container) return;

        const nameMap = {
            '^GSPC': 'S&P 500',
            '^IXIC': 'NASDAQ',
            '^DJI': 'DOW',
            '^VIX': 'VIX'
        };

        container.innerHTML = (data.results || []).map(idx => `
      <div class="index-chip anim-fade-in-up">
        <span class="index-chip__name">${nameMap[idx.symbol] || idx.shortName}</span>
        <span class="index-chip__value">${formatCurrency(idx.price, idx.price > 1000 ? 0 : 2)}</span>
        <span class="index-chip__change ${changeClass(idx.changePercent)}">
          ${formatPercent(idx.changePercent)}
        </span>
      </div>
    `).join('');
    } catch (err) {
        showError('Failed to load market indices');
    }
}

async function loadTrending(category) {
    const grid = document.getElementById('stock-grid');
    if (!grid) return;
    grid.innerHTML = skeletonStockCard(8);

    try {
        const data = await MarketAPI.getTrending(category);
        if (!grid) return;

        if (!data.results || data.results.length === 0) {
            grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p class="empty-state__title">No data available</p>
          <p class="empty-state__description">Market data is currently unavailable. Try refreshing.</p>
        </div>`;
            return;
        }

        grid.innerHTML = data.results.map(stock => renderStockCard(stock)).join('');

        // Click handlers
        grid.querySelectorAll('.stock-card').forEach(card => {
            card.addEventListener('click', () => {
                const ticker = card.dataset.ticker;
                if (ticker) navigate(`/symbol/${ticker}`);
            });
        });

        // Load sparklines
        data.results.forEach(stock => loadSparkline(stock.symbol));
    } catch (err) {
        showError('Failed to load trending stocks');
        if (grid) grid.innerHTML = skeletonStockCard(4);
    }
}

function renderStockCard(stock) {
    return `
    <div class="glass-card stock-card interactive" data-ticker="${stock.symbol}">
      <div class="stock-card__header">
        <div>
          <div class="stock-card__symbol">${stock.symbol}</div>
          <div class="stock-card__name">${stock.shortName || ''}</div>
        </div>
        <div>
          <div class="stock-card__price">${formatCurrency(stock.price)}</div>
          <div class="stock-card__change ${changeClass(stock.changePercent)}">
            ${formatPercent(stock.changePercent)}
          </div>
        </div>
      </div>
      <canvas class="stock-card__sparkline" id="spark-${stock.symbol}" width="200" height="40"></canvas>
    </div>
  `;
}

async function loadSparkline(symbol) {
    try {
        const data = await MarketAPI.getSparkline(symbol);
        const canvas = document.getElementById(`spark-${symbol}`);
        if (!canvas || !data.closes || data.closes.length < 2) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const closes = data.closes;
        const min = Math.min(...closes);
        const max = Math.max(...closes);
        const range = max - min || 1;
        const isPositive = closes[closes.length - 1] >= closes[0];

        ctx.beginPath();
        ctx.strokeStyle = isPositive ? '#10B981' : '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';

        closes.forEach((val, i) => {
            const x = (i / (closes.length - 1)) * w;
            const y = h - ((val - min) / range) * (h * 0.8) - h * 0.1;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Gradient fill
        const lastX = w;
        const lastY = h - ((closes[closes.length - 1] - min) / range) * (h * 0.8) - h * 0.1;
        ctx.lineTo(lastX, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, isPositive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();

    } catch (_) { }
}
