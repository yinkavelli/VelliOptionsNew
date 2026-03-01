// ===== APP ENTRY POINT =====
import { initTheme, toggleTheme } from './theme.js';
import { registerRoute, initRouter, navigate } from './router.js';
import { renderMarketPage } from './pages/market.js';
import { renderSymbolPage } from './pages/symbol.js';
import { renderScreenerPage } from './pages/screener.js';
import { getState, setState } from './state.js';
import { MarketAPI } from './api.js';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupTopBar();
    setupBottomNav();
    setupSearchOverlay();
    registerRoutes();
    initRouter();
});

function registerRoutes() {
    registerRoute('/', () => { setActiveNav('market'); renderMarketPage(); });
    registerRoute('/symbol/:ticker', (params) => { setActiveNav('market'); return renderSymbolPage(params); });
    registerRoute('/screener', () => { setActiveNav('screener'); renderScreenerPage(); });
}

function setupTopBar() {
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    document.getElementById('search-btn')?.addEventListener('click', () => {
        document.getElementById('search-overlay')?.classList.add('open');
        setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    });
}

function setupBottomNav() {
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
        item.addEventListener('click', () => {
            const route = item.dataset.route;
            if (route) navigate(route);
        });
    });
}

function setActiveNav(page) {
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
}

function setupSearchOverlay() {
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const cancel = document.getElementById('search-cancel');

    if (!overlay || !input) return;

    cancel?.addEventListener('click', () => {
        overlay.classList.remove('open');
        input.value = '';
        if (results) results.innerHTML = '';
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) {
            overlay.classList.remove('open');
            input.value = '';
            if (results) results.innerHTML = '';
        }
    });

    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 1) { if (results) results.innerHTML = ''; return; }
        debounceTimer = setTimeout(async () => {
            try {
                const data = await MarketAPI.search(q);
                if (!results) return;
                if (!data.results?.length) {
                    results.innerHTML = '<div style="padding:var(--space-6);text-align:center;color:var(--text-secondary);">No results found</div>';
                    return;
                }
                results.innerHTML = data.results.map(r => `
          <div class="search-result-item" data-symbol="${r.symbol}">
            <span class="search-result-item__symbol">${r.symbol}</span>
            <span class="search-result-item__name">${r.name}</span>
            <span class="search-result-item__type">${r.type}</span>
          </div>
        `).join('');
                results.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        overlay.classList.remove('open');
                        input.value = '';
                        results.innerHTML = '';
                        navigate(`/symbol/${item.dataset.symbol}`);
                    });
                });
            } catch (_) { }
        }, 300);
    });
}
