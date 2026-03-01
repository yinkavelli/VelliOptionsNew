// ===== SIMPLE PUB/SUB STATE MANAGEMENT =====

const state = {
    currentPage: 'market',
    currentTicker: null,
    theme: localStorage.getItem('oi-theme') || 'dark',
    searchOpen: false,

    // Market page
    indices: [],
    trending: [],
    trendingCategory: 'most_active',

    // Symbol page
    quote: null,
    chartData: null,
    chartRange: '1d',
    optionsChain: [],
    selectedExpiration: null,
    selectedContractType: 'call',
    selectedContracts: [],

    // Screener
    screenerFilters: JSON.parse(localStorage.getItem('oi-filters') || 'null') || {
        minVolume: 1000000,
        minMarketCap: 10000000000,
        ivRankMin: 10,
        ivRankMax: 70
    },
    screenerResults: [],
    screenerLoading: false,

    // Strategy results
    strategies: [],
    strategiesLoading: false,
    analyzingTicker: null,

    // UI
    loading: {},
    errors: {}
};

const listeners = new Map();

export function getState() {
    return state;
}

export function setState(updates) {
    Object.assign(state, updates);

    // Persist certain values
    if ('theme' in updates) {
        localStorage.setItem('oi-theme', updates.theme);
    }
    if ('screenerFilters' in updates) {
        localStorage.setItem('oi-filters', JSON.stringify(updates.screenerFilters));
    }

    // Notify listeners
    const changedKeys = Object.keys(updates);
    changedKeys.forEach(key => {
        const keyListeners = listeners.get(key);
        if (keyListeners) {
            keyListeners.forEach(fn => fn(state[key], state));
        }
    });

    // Notify wildcard listeners
    const wildcardListeners = listeners.get('*');
    if (wildcardListeners) {
        wildcardListeners.forEach(fn => fn(state));
    }
}

export function subscribe(key, callback) {
    if (!listeners.has(key)) {
        listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);

    return () => {
        listeners.get(key).delete(callback);
    };
}

export function setLoading(key, isLoading) {
    setState({ loading: { ...state.loading, [key]: isLoading } });
}

export function setError(key, error) {
    setState({ errors: { ...state.errors, [key]: error } });
}

export function isLoading(key) {
    return !!state.loading[key];
}

export function getError(key) {
    return state.errors[key] || null;
}
