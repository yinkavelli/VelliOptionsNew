const express = require('express');
const router = express.Router();

const YF_BASE = 'https://query1.finance.yahoo.com';
const YF_BASE2 = 'https://query2.finance.yahoo.com';

async function yfFetch(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    if (!res.ok) {
        const err = new Error(`Yahoo Finance API error: ${res.status}`);
        err.statusCode = res.status;
        throw err;
    }
    return res.json();
}

// GET /api/market/indices
router.get('/indices', async (req, res, next) => {
    try {
        const symbols = ['^GSPC', '^IXIC', '^DJI', '^VIX'];
        const results = await Promise.all(symbols.map(async (sym) => {
            try {
                const data = await yfFetch(
                    `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d&includePrePost=false`
                );
                const meta = data.chart?.result?.[0]?.meta;
                if (!meta) return null;
                const price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose || meta.previousClose;
                const change = price - prevClose;
                const changePercent = prevClose ? (change / prevClose) * 100 : 0;
                return {
                    symbol: sym,
                    shortName: sym,
                    price,
                    change,
                    changePercent,
                    previousClose: prevClose
                };
            } catch (_) { return null; }
        }));
        res.json({ results: results.filter(Boolean) });
    } catch (err) {
        next(err);
    }
});

// GET /api/market/search?q=AAPL
router.get('/search', async (req, res, next) => {
    try {
        const q = req.query.q;
        if (!q || q.length < 1) return res.json({ results: [] });
        const data = await yfFetch(
            `${YF_BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`
        );
        const results = (data.quotes || [])
            .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
            .map(q => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                type: q.quoteType,
                exchange: q.exchDisp
            }));
        res.json({ results });
    } catch (err) {
        next(err);
    }
});

// GET /api/market/quote/:ticker
router.get('/quote/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        // Use v8 chart meta for quote data (v6 quote endpoint blocked)
        const data = await yfFetch(
            `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`
        );
        const chart = data.chart?.result?.[0];
        if (!chart) {
            const err = new Error(`No data found for ${ticker}`);
            err.statusCode = 404;
            throw err;
        }
        const meta = chart.meta;
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const change = price - prevClose;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;
        const quotes = chart.indicators?.quote?.[0] || {};
        const timestamps = chart.timestamp || [];
        const lastIdx = timestamps.length - 1;

        // Extract volume from most recent trading day
        const volume = lastIdx >= 0 ? quotes.volume?.[lastIdx] : null;
        const dayHigh = lastIdx >= 0 ? quotes.high?.[lastIdx] : null;
        const dayLow = lastIdx >= 0 ? quotes.low?.[lastIdx] : null;
        const open = lastIdx >= 0 ? quotes.open?.[lastIdx] : null;

        // Get 52-week data from a longer range
        let fiftyTwoWeekHigh = null, fiftyTwoWeekLow = null;
        try {
            const yearData = await yfFetch(
                `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1wk&includePrePost=false`
            );
            const yearQuotes = yearData.chart?.result?.[0]?.indicators?.quote?.[0];
            if (yearQuotes) {
                const highs = (yearQuotes.high || []).filter(v => v !== null);
                const lows = (yearQuotes.low || []).filter(v => v !== null);
                fiftyTwoWeekHigh = highs.length ? Math.max(...highs) : null;
                fiftyTwoWeekLow = lows.length ? Math.min(...lows) : null;
            }
        } catch (_) { }

        res.json({
            symbol: meta.symbol || ticker,
            shortName: meta.shortName || meta.symbol || ticker,
            longName: meta.longName || meta.shortName || meta.symbol || ticker,
            price,
            change,
            changePercent,
            previousClose: prevClose,
            open,
            dayHigh,
            dayLow,
            volume,
            avgVolume: null,
            marketCap: null,
            trailingPE: null,
            forwardPE: null,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
            dividendYield: null,
            beta: null,
            marketState: meta.marketState || 'REGULAR',
            exchange: meta.exchangeName || meta.fullExchangeName || '',
            currency: meta.currency || 'USD'
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/market/chart/:ticker?range=1d&interval=5m
router.get('/chart/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const range = req.query.range || '1d';
        const intervalMap = {
            '1d': '5m', '5d': '15m', '1mo': '1d', '3mo': '1d',
            '6mo': '1d', '1y': '1wk', '5y': '1mo'
        };
        const interval = req.query.interval || intervalMap[range] || '1d';
        const data = await yfFetch(
            `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
        );
        const chart = data.chart?.result?.[0];
        if (!chart) {
            const err = new Error(`No chart data for ${ticker}`);
            err.statusCode = 404;
            throw err;
        }
        const timestamps = chart.timestamp || [];
        const quotes = chart.indicators?.quote?.[0] || {};
        const points = timestamps.map((t, i) => ({
            time: t,
            open: quotes.open?.[i],
            high: quotes.high?.[i],
            low: quotes.low?.[i],
            close: quotes.close?.[i],
            volume: quotes.volume?.[i]
        })).filter(p => p.close !== null && p.close !== undefined);

        res.json({
            symbol: ticker,
            range,
            interval,
            points,
            previousClose: chart.meta?.chartPreviousClose
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/market/trending
router.get('/trending', async (req, res, next) => {
    try {
        const category = req.query.category || 'most_active';
        let url;
        if (category === 'gainers') {
            url = `${YF_BASE}/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_gainers&count=15`;
        } else if (category === 'losers') {
            url = `${YF_BASE}/v1/finance/screener/predefined/saved?formatted=false&scrIds=day_losers&count=15`;
        } else {
            url = `${YF_BASE}/v1/finance/screener/predefined/saved?formatted=false&scrIds=most_actives&count=15`;
        }
        const data = await yfFetch(url);
        const quotes = data.finance?.result?.[0]?.quotes || [];
        const results = quotes.map(q => ({
            symbol: q.symbol,
            shortName: q.shortName || q.longName || q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            volume: q.regularMarketVolume,
            marketCap: q.marketCap
        }));
        res.json({ results, category });
    } catch (err) {
        next(err);
    }
});

// POST /api/market/screen
router.post('/screen', async (req, res, next) => {
    try {
        const {
            minVolume = 1000000,
            minMarketCap = 10000000000,
        } = req.body;

        const screenerBody = {
            offset: 0,
            size: 50,
            sortField: 'intradaymarketcap',
            sortType: 'desc',
            quoteType: 'equity',
            query: {
                operator: 'and',
                operands: [
                    { operator: 'gt', operands: ['avgdailyvol3m', minVolume] },
                    { operator: 'gt', operands: ['intradaymarketcap', minMarketCap] },
                    { operator: 'eq', operands: ['exchange', 'NMS'] },
                ]
            }
        };

        const response = await fetch(`${YF_BASE}/v1/finance/screener?formatted=false&crumb=`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(screenerBody)
        });

        if (!response.ok) {
            // Fallback: use predefined most_actives and filter client-side
            const fallbackData = await yfFetch(
                `${YF_BASE}/v1/finance/screener/predefined/saved?formatted=false&scrIds=most_actives&count=50`
            );
            const quotes = fallbackData.finance?.result?.[0]?.quotes || [];
            const filtered = quotes.filter(q =>
                (q.averageDailyVolume3Month || q.regularMarketVolume || 0) >= minVolume &&
                (q.marketCap || 0) >= minMarketCap
            );
            const results = filtered.map(q => ({
                symbol: q.symbol,
                shortName: q.shortName || q.longName || q.symbol,
                price: q.regularMarketPrice,
                change: q.regularMarketChange,
                changePercent: q.regularMarketChangePercent,
                volume: q.regularMarketVolume,
                avgVolume: q.averageDailyVolume3Month,
                marketCap: q.marketCap
            }));
            return res.json({ results, source: 'fallback_filtered' });
        }

        const data = await response.json();
        const quotes = data.finance?.result?.[0]?.quotes || [];
        const results = quotes.map(q => ({
            symbol: q.symbol,
            shortName: q.shortName || q.longName || q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            volume: q.regularMarketVolume,
            avgVolume: q.averageDailyVolume3Month,
            marketCap: q.marketCap
        }));
        res.json({ results, source: 'screener' });
    } catch (err) {
        next(err);
    }
});

// GET /api/market/sparkline/:ticker
router.get('/sparkline/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const data = await yfFetch(
            `${YF_BASE2}/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d&includePrePost=false`
        );
        const chart = data.chart?.result?.[0];
        const closes = (chart?.indicators?.quote?.[0]?.close || []).filter(v => v !== null);
        res.json({ symbol: ticker, closes });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
