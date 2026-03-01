const express = require('express');
const router = express.Router();

const MASSIVE_BASE = 'https://api.massive.com';
const API_KEY = process.env.MASSIVE_API_KEY;

async function massiveFetch(endpoint, params = {}) {
    const url = new URL(`${MASSIVE_BASE}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
            url.searchParams.set(k, v);
        }
    });

    const res = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
        }
    });

    if (!res.ok) {
        const body = await res.text();
        const err = new Error(`Massive API error ${res.status}: ${body}`);
        err.statusCode = res.status;
        throw err;
    }

    return res.json();
}

// GET /api/options/chain/:ticker
router.get('/chain/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        // Pass all query params through to Massive API (supports dot-notation like expiration_date.gte)
        const params = { ...req.query };
        if (!params.limit) params.limit = 250;

        const data = await massiveFetch(`/v3/snapshot/options/${ticker.toUpperCase()}`, params);

        const results = (data.results || []).map(c => {
            const d = c.details || {};
            const lastPrice = c.last_quote?.last_trade?.price || c.day?.close || null;
            let bid = c.last_quote?.bid || null;
            let ask = c.last_quote?.ask || null;
            let midpoint = c.last_quote?.midpoint || null;
            let quoteSource = 'live';

            // If no bid/ask from API, estimate from last price + IV spread
            if (bid === null && ask === null && lastPrice !== null) {
                const iv = c.implied_volatility || 0.3;
                const vol = c.day?.volume || 0;
                // Estimate spread: wider for high IV / low volume, tighter for liquid contracts
                const baseSpread = lastPrice * Math.min(iv * 0.02, 0.05);
                const spreadMultiplier = vol > 100 ? 1 : vol > 10 ? 1.5 : 2.5;
                const halfSpread = Math.max(0.01, baseSpread * spreadMultiplier);
                bid = Math.max(0.01, Math.round((lastPrice - halfSpread) * 100) / 100);
                ask = Math.round((lastPrice + halfSpread) * 100) / 100;
                midpoint = Math.round(((bid + ask) / 2) * 100) / 100;
                quoteSource = 'estimated';
            }

            return {
                ticker: d.ticker || c.ticker,
                contractType: d.contract_type || c.contract_type,
                strikePrice: d.strike_price || c.strike_price,
                expirationDate: d.expiration_date || c.expiration_date,
                sharesPerContract: d.shares_per_contract || 100,
                greeks: c.greeks || {},
                impliedVolatility: c.implied_volatility,
                openInterest: c.open_interest,
                bid,
                ask,
                midpoint,
                lastPrice,
                fmv: c.fmv || null,
                volume: c.day?.volume || 0,
                changeToBreakeven: c.underlying_asset?.change_to_break_even,
                underlyingPrice: typeof c.underlying_asset?.price === 'number' ? c.underlying_asset.price : null,
                quoteSource
            };
        });

        // Extract unique expiration dates for the selector
        const expirations = [...new Set(results.map(r => r.expirationDate))].sort();

        res.json({
            results,
            count: results.length,
            expirations,
            underlyingTicker: ticker.toUpperCase()
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/options/contracts/:ticker
router.get('/contracts/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const { limit = 250 } = req.query;

        const data = await massiveFetch(`/v3/reference/options/contracts`, {
            'underlying_ticker': ticker.toUpperCase(),
            limit
        });

        const results = (data.results || []).map(c => ({
            ticker: c.ticker,
            contractType: c.contract_type,
            strikePrice: c.strike_price,
            expirationDate: c.expiration_date,
            exerciseStyle: c.exercise_style,
            sharesPerContract: c.shares_per_contract || 100,
            primaryExchange: c.primary_exchange
        }));

        res.json({ results, count: results.length });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
