// ===== SPA ROUTER =====

import { setState, getState } from './state.js';

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
    routes[path] = handler;
}

export function navigate(path, pushState = true) {
    if (pushState) {
        window.history.pushState({}, '', `#${path}`);
    }

    const parsed = parsePath(path);

    // Cleanup previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
        currentCleanup();
    }

    // Find matching route
    let handler = null;
    let params = {};

    // Check exact match first
    if (routes[parsed.route]) {
        handler = routes[parsed.route];
        params = parsed.params;
    } else {
        // Check parameterized routes
        for (const [pattern, h] of Object.entries(routes)) {
            const match = matchRoute(pattern, parsed.route);
            if (match) {
                handler = h;
                params = { ...match, ...parsed.params };
                break;
            }
        }
    }

    if (handler) {
        setState({ currentPage: parsed.route.split('/')[1] || 'market' });
        const result = handler(params);
        if (result && typeof result === 'function') {
            currentCleanup = result;
        } else {
            currentCleanup = null;
        }
    }
}

function parsePath(path) {
    const clean = path.replace(/^#?\/?/, '');
    const parts = clean.split('?');
    const route = '/' + (parts[0] || '');
    const params = {};
    if (parts[1]) {
        new URLSearchParams(parts[1]).forEach((v, k) => params[k] = v);
    }
    return { route, params };
}

function matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }

    return params;
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const hash = window.location.hash.slice(1) || '/';
        navigate(hash, false);
    });

    // Initial route
    const hash = window.location.hash.slice(1) || '/';
    navigate(hash, false);
}
