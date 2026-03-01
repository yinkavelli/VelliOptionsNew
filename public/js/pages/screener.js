// ===== SCREENER PAGE =====
import { MarketAPI, OptionsAPI } from '../api.js';
import { getState, setState } from '../state.js';
import { showError, showToast } from '../components/toast.js';
import { skeletonCard, skeletonStrategyCard } from '../components/skeleton.js';
import { formatCurrency, formatPercent, formatCompact, changeClass, formatDateShort } from '../utils/formatters.js';
import { navigate } from '../router.js';
import { analyzeOptions, generateExplainer, GREEK_TOOLTIPS } from '../utils/calculations.js';

export function renderScreenerPage() {
  const f = getState().screenerFilters;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page container">
      <section class="section">
        <h1 style="margin-bottom:var(--space-2);">Options Screener</h1>
        <p class="text-secondary" style="margin-bottom:var(--space-6);">Scan the entire US equity universe for high-probability strategies</p>
      </section>
      <section class="glass-card accordion open section" id="filter-section">
        <button class="accordion__header">Screening Criteria<svg class="accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="accordion__body"><div class="accordion__content">
          <div class="filter-panel" id="filter-panel">
            <div class="filter-row">
              <div class="input-group"><label>Min. Daily Volume</label><input type="number" class="input" id="min-volume" value="${f.minVolume}" min="100000" max="100000000" step="100000"></div>
              <div class="input-group"><label>Min. Market Cap</label><select class="select" id="min-market-cap">
                <option value="1000000000" ${f.minMarketCap == 1e9 ? 'selected' : ''}>$1B+</option>
                <option value="5000000000" ${f.minMarketCap == 5e9 ? 'selected' : ''}>$5B+</option>
                <option value="10000000000" ${f.minMarketCap == 1e10 ? 'selected' : ''}>$10B+</option>
                <option value="50000000000" ${f.minMarketCap == 5e10 ? 'selected' : ''}>$50B+</option>
                <option value="100000000000" ${f.minMarketCap == 1e11 ? 'selected' : ''}>$100B+</option>
              </select></div>
            </div>
            <div class="input-group"><label>IV Rank Range</label>
              <div style="display:flex;gap:var(--space-3);align-items:center;">
                <input type="number" class="input" id="iv-min" value="${f.ivRankMin}" min="0" max="100" style="width:80px;">
                <span class="text-secondary">to</span>
                <input type="number" class="input" id="iv-max" value="${f.ivRankMax}" min="0" max="100" style="width:80px;">
                <span class="text-secondary">%</span>
              </div>
            </div>
            <div style="display:flex;gap:var(--space-3);">
              <button class="btn btn-primary w-full" id="scan-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Scan Market</button>
              <button class="btn btn-ghost" id="reset-btn">Reset</button>
            </div>
          </div>
        </div></div>
      </section>
      <section id="results-section" class="section"></section>
      <section id="screener-strategies" class="section hidden"></section>
    </div>`;
  setupHandlers();
}

function setupHandlers() {
  document.querySelectorAll('.accordion__header').forEach(h =>
    h.addEventListener('click', () => h.parentElement.classList.toggle('open')));
  document.getElementById('scan-btn')?.addEventListener('click', runScan);
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    const d = { minVolume: 1000000, minMarketCap: 10000000000, ivRankMin: 10, ivRankMax: 70 };
    setState({ screenerFilters: d });
    document.getElementById('min-volume').value = d.minVolume;
    document.getElementById('min-market-cap').value = d.minMarketCap;
    document.getElementById('iv-min').value = d.ivRankMin;
    document.getElementById('iv-max').value = d.ivRankMax;
    showToast('Filters reset', 'info');
  });
}

async function runScan() {
  const btn = document.getElementById('scan-btn');
  const minVolume = parseInt(document.getElementById('min-volume').value) || 1000000;
  const minMarketCap = parseInt(document.getElementById('min-market-cap').value) || 1e10;
  const ivMin = parseInt(document.getElementById('iv-min').value) || 0;
  const ivMax = parseInt(document.getElementById('iv-max').value) || 100;
  if (ivMin >= ivMax) { showError('IV min must be less than max'); return; }
  setState({ screenerFilters: { minVolume, minMarketCap, ivRankMin: ivMin, ivRankMax: ivMax } });
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning...';
  const rs = document.getElementById('results-section');
  try {
    rs.innerHTML = `<div class="section-header"><h2>Scanning...</h2></div>${skeletonCard(4)}`;
    const data = await MarketAPI.screen({ minVolume, minMarketCap });
    if (!data.results?.length) {
      rs.innerHTML = `<div class="glass-card empty-state"><svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><p class="empty-state__title">No stocks match</p><p class="empty-state__description">Try relaxing your filters.</p></div>`;
      return;
    }
    rs.innerHTML = `<div class="section-header"><h2>Results</h2><span class="badge badge-accent">${data.results.length} stocks</span></div><div class="stagger" id="result-cards">${data.results.map(renderResultCard).join('')}</div>`;
    rs.querySelectorAll('.analyze-stock-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); analyzeFromScreener(b.dataset.ticker); }));
    rs.querySelectorAll('.results-card').forEach(c => c.addEventListener('click', () => navigate(`/symbol/${c.dataset.ticker}`)));
  } catch (err) {
    showError('Scan failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Scan Market';
  }
}

function renderResultCard(s) {
  return `<div class="glass-card results-card interactive" data-ticker="${s.symbol}" style="margin-bottom:var(--space-3);cursor:pointer;"><div class="results-card__info"><div class="flex items-center gap-2"><span style="font-weight:700;">${s.symbol}</span><span class="text-secondary text-sm" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.shortName || ''}</span></div><div class="results-card__row"><span class="font-mono" style="font-weight:600;">${formatCurrency(s.price)}</span><span class="font-mono ${changeClass(s.changePercent)}" style="font-size:0.8125rem;">${formatPercent(s.changePercent)}</span></div><div class="results-card__row"><span class="results-card__stat">MCap <span>${formatCompact(s.marketCap)}</span></span><span class="results-card__stat">Vol <span>${formatCompact(s.volume)}</span></span></div></div><button class="btn btn-primary analyze-stock-btn" data-ticker="${s.symbol}" style="flex-shrink:0;padding:0 var(--space-4);height:36px;font-size:0.75rem;">Analyze →</button></div>`;
}

async function analyzeFromScreener(ticker) {
  const sec = document.getElementById('screener-strategies');
  sec.classList.remove('hidden');
  sec.innerHTML = `<div class="section-header"><h2>Analyzing ${ticker}...</h2></div>${skeletonStrategyCard(3)}`;
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const quote = await MarketAPI.getQuote(ticker);
    const currentPrice = quote?.price || 0;

    // Same focused query as symbol page: 30-60 DTE, ±15% strike range
    const strikeLow = Math.round(currentPrice * 0.85);
    const strikeHigh = Math.round(currentPrice * 1.15);
    const minExpDate = new Date();
    minExpDate.setDate(minExpDate.getDate() + 30);
    const maxExpDate = new Date();
    maxExpDate.setDate(maxExpDate.getDate() + 60);
    const minDateStr = minExpDate.toISOString().split('T')[0];
    const maxDateStr = maxExpDate.toISOString().split('T')[0];

    const chain = await OptionsAPI.getChain(ticker, {
      limit: 250,
      'expiration_date.gte': minDateStr,
      'expiration_date.lte': maxDateStr,
      'strike_price.gte': strikeLow,
      'strike_price.lte': strikeHigh,
      sort: 'strike_price'
    });
    const price = currentPrice || chain.results[0]?.underlyingPrice || 0;
    const strats = analyzeOptions(chain.results, price);
    if (!strats.length) {
      sec.innerHTML = `<div class="section-header"><h2>Strategies for ${ticker}</h2></div><div class="glass-card empty-state"><p class="empty-state__title">No qualifying strategies</p><p class="empty-state__description">No strategies scored above 40/100 for ${ticker}. This could be due to low IV or limited option chain data.</p></div>`;
      return;
    }
    sec.innerHTML = `<div class="section-header"><h2>Strategies for ${ticker}</h2><span class="badge badge-accent">${strats.length} found</span></div><div class="stagger">${strats.map(renderStratCard).join('')}</div>`;
    sec.querySelectorAll('.explainer-toggle').forEach(b => b.addEventListener('click', () => {
      const t = document.getElementById(b.dataset.target);
      if (t) { t.classList.toggle('hidden'); b.textContent = t.classList.contains('hidden') ? '▸ Why This Strategy?' : '▾ Hide'; }
    }));
    sec.querySelectorAll('.greek-badge').forEach(b => b.addEventListener('click', () => b.classList.toggle('active')));
  } catch (err) { showError(`Analysis failed: ${err.message}`); }
}

function renderStratCard(s) {
  const ex = generateExplainer(s);
  const eid = `scr-exp-${s.id}`;
  const pc = s.pop >= 65 ? 'high' : s.pop >= 40 ? 'medium' : 'low';
  const legs = s.legs.map(l => `<div><div class="strategy-card__leg-label">${l.side === 'buy' ? 'Buy' : 'Sell'}</div><div class="strategy-card__leg-value">${l.strikePrice} ${l.contractType[0].toUpperCase() + l.contractType.slice(1)}</div></div>`).join('');
  const greeks = [{ s: 'Δ', k: 'delta' }, { s: 'Θ', k: 'theta' }, { s: 'Γ', k: 'gamma' }, { s: 'V', k: 'vega' }].map(g => {
    const v = s.greeks?.[g.k]; const tt = GREEK_TOOLTIPS[g.k] ? GREEK_TOOLTIPS[g.k](v || 0) : '';
    return `<div class="greek-badge tooltip-trigger"><span class="greek-badge__symbol">${g.s}</span><span class="greek-badge__value">${v !== undefined ? v.toFixed(3) : '—'}</span>${tt ? `<div class="tooltip-content">${tt}</div>` : ''}</div>`;
  }).join('');
  const be = typeof s.breakeven === 'number' ? formatCurrency(s.breakeven) : s.breakeven;
  const expStr = s.expiration ? new Date(s.expiration + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  return `<div class="glass-card strategy-card" style="margin-bottom:var(--space-3);"><div class="strategy-card__header"><span class="strategy-card__type">${s.name}</span><span class="strategy-card__score">★ ${s.score}%</span></div><div class="strategy-card__subtitle">${s.subtitle}</div><div class="strategy-card__legs">${legs}</div><div class="strategy-card__metrics"><div class="strategy-card__metric"><span class="strategy-card__metric-label">Exp</span><span class="strategy-card__metric-value">${expStr}</span></div><div class="strategy-card__metric"><span class="strategy-card__metric-label">DTE</span><span class="strategy-card__metric-value">${s.dte}d</span></div><div class="strategy-card__metric"><span class="strategy-card__metric-label">Credit</span><span class="strategy-card__metric-value text-positive">${formatCurrency(s.credit)}</span></div><div class="strategy-card__metric"><span class="strategy-card__metric-label">Max Risk</span><span class="strategy-card__metric-value text-negative">${formatCurrency(s.maxRisk)}</span></div><div class="strategy-card__metric"><span class="strategy-card__metric-label">Max Profit</span><span class="strategy-card__metric-value text-positive">${formatCurrency(s.maxProfit)}</span></div><div class="strategy-card__metric"><span class="strategy-card__metric-label">Breakeven</span><span class="strategy-card__metric-value">${be}</span></div></div><div class="strategy-card__section-title">Probability</div><div class="probability-bar" style="margin-bottom:var(--space-2);"><span class="strategy-card__metric-label">POP</span><div class="probability-bar__track"><div class="probability-bar__fill ${pc}" style="width:${s.pop}%"></div></div><span class="probability-bar__label ${s.pop >= 60 ? 'text-positive' : 'text-accent'}">${s.pop}%</span></div><div class="strategy-card__section-title">Greeks</div><div class="strategy-card__greeks">${greeks}</div><div class="strategy-card__actions"><button class="btn btn-secondary explainer-toggle" data-target="${eid}" style="flex:1;">▸ Why This Strategy?</button></div><div id="${eid}" class="hidden">${ex.map(e => `<div class="explainer"><div class="explainer__question">${e.question}</div><div class="explainer__answer">${e.answer}</div></div>`).join('')}</div></div>`;
}
