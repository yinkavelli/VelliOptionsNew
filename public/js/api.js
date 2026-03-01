// ===== API CLIENT =====
// Centralized fetch wrapper with error handling, caching, and loading states

const API_CACHE = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCacheKey(url) {
    return url;
}

function getCached(key) {
    const entry = API_CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        API_CACHE.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data) {
    API_CACHE.set(key, { data, timestamp: Date.now() });
}

export async function apiFetch(endpoint, options = {}) {
    const {
        method = 'GET',
        body,
        cache = true,
        signal
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : endpoint;
    const cacheKey = getCacheKey(url);

    if (cache && method === 'GET') {
        const cached = getCached(cacheKey);
        if (cached) return cached;
    }

    const fetchOptions = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal
    };

    if (body) {
        fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        let errorMessage = `Request failed (${response.status})`;
        try {
            const errData = await response.json();
            errorMessage = errData.message || errorMessage;
        } catch (_) { }
        throw new Error(errorMessage);
    }

    const data = await response.json();

    if (cache && method === 'GET') {
        setCache(cacheKey, data);
    }

    return data;
}

// === Market API ===
export const MarketAPI = {
    getIndices: () => apiFetch('/api/market/indices'),

    search: (query) => apiFetch(`/api/market/search?q=${encodeURIComponent(query)}`, { cache: false }),

    getQuote: (ticker) => apiFetch(`/api/market/quote/${encodeURIComponent(ticker)}`),

    getChart: (ticker, range = '1d') => apiFetch(`/api/market/chart/${encodeURIComponent(ticker)}?range=${range}`),

    getTrending: (category = 'most_active') => apiFetch(`/api/market/trending?category=${category}`),

    getSparkline: (ticker) => apiFetch(`/api/market/sparkline/${encodeURIComponent(ticker)}`),

    screen: (filters) => apiFetch('/api/market/screen', { method: 'POST', body: filters, cache: false })
};

// === Options API ===
export const OptionsAPI = {
    getChain: (ticker, params = {}) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.set(k, v);
        });
        const query = qs.toString();
        return apiFetch(`/api/options/chain/${encodeURIComponent(ticker)}${query ? '?' + query : ''}`);
    },

    getContracts: (ticker) => apiFetch(`/api/options/contracts/${encodeURIComponent(ticker)}`)
};

// === Alpha Vantage API ===
export const AlphaVantageAPI = {
    getOverview: (ticker) => apiFetch(`/api/av/overview/${encodeURIComponent(ticker)}`),
    getEarnings: (ticker) => apiFetch(`/api/av/earnings/${encodeURIComponent(ticker)}`),
    getNews: (ticker) => apiFetch(`/api/av/news/${encodeURIComponent(ticker)}`),
};

export function clearCache() {
    API_CACHE.clear();
}
