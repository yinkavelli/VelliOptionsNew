const express = require('express');
const router = express.Router();
const https = require('https');

const AV_BASE = 'https://www.alphavantage.co/query';
const API_KEY = process.env.ALPHA_VANTAGE_KEY;

// Custom HTTPS agent to handle certificate validation issues on some systems
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// In-memory cache with 24-hour TTL for fundamentals, 1-hour for news
const cache = new Map();
const CACHE_TTL_LONG = 24 * 60 * 60 * 1000;  // 24 hours (fundamentals)
const CACHE_TTL_SHORT = 60 * 60 * 1000;       // 1 hour (news)

function getCached(key, ttl) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

async function avFetch(params) {
    if (!API_KEY) throw new Error('Alpha Vantage API key not configured');
    const qs = new URLSearchParams({ ...params, apikey: API_KEY });
    const url = `${AV_BASE}?${qs}`;

    // Use a promise-based https.get to bypass TLS cert issues
    return new Promise((resolve, reject) => {
        https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'OptionIntel/1.0' } }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data['Error Message']) return reject(new Error(data['Error Message']));
                    if (data['Note']) {
                        console.warn('[AV] Rate limit warning:', data['Note']);
                        return reject(new Error('Alpha Vantage rate limit reached. Try again later.'));
                    }
                    resolve(data);
                } catch (e) {
                    reject(new Error('Failed to parse Alpha Vantage response'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

// GET /api/av/overview/:ticker — Company fundamentals
router.get('/overview/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const cacheKey = `overview:${ticker.toUpperCase()}`;
        const cached = getCached(cacheKey, CACHE_TTL_LONG);
        if (cached) return res.json(cached);

        const raw = await avFetch({ function: 'OVERVIEW', symbol: ticker });

        // Normalize into a clean object
        const data = {
            symbol: raw.Symbol || ticker,
            name: raw.Name || '',
            description: raw.Description || '',
            sector: raw.Sector || '',
            industry: raw.Industry || '',
            exchange: raw.Exchange || '',
            currency: raw.Currency || 'USD',
            country: raw.Country || '',
            // Valuation
            marketCap: parseFloat(raw.MarketCapitalization) || null,
            peRatio: parseFloat(raw.PERatio) || null,
            pegRatio: parseFloat(raw.PEGRatio) || null,
            forwardPE: parseFloat(raw.ForwardPE) || null,
            priceToBook: parseFloat(raw.PriceToBookRatio) || null,
            priceToSales: parseFloat(raw.PriceToSalesRatioTTM) || null,
            evToRevenue: parseFloat(raw.EVToRevenue) || null,
            evToEBITDA: parseFloat(raw.EVToEBITDA) || null,
            // Financials
            eps: parseFloat(raw.EPS) || null,
            revenuePerShare: parseFloat(raw.RevenuePerShareTTM) || null,
            profitMargin: parseFloat(raw.ProfitMargin) || null,
            operatingMargin: parseFloat(raw.OperatingMarginTTM) || null,
            returnOnEquity: parseFloat(raw.ReturnOnEquityTTM) || null,
            returnOnAssets: parseFloat(raw.ReturnOnAssetsTTM) || null,
            revenueTTM: parseFloat(raw.RevenueTTM) || null,
            grossProfitTTM: parseFloat(raw.GrossProfitTTM) || null,
            // Dividends
            dividendPerShare: parseFloat(raw.DividendPerShare) || null,
            dividendYield: parseFloat(raw.DividendYield) || null,
            exDividendDate: raw.ExDividendDate || null,
            // Volatility & Range
            beta: parseFloat(raw.Beta) || null,
            fiftyTwoWeekHigh: parseFloat(raw['52WeekHigh']) || null,
            fiftyTwoWeekLow: parseFloat(raw['52WeekLow']) || null,
            fiftyDayMA: parseFloat(raw['50DayMovingAverage']) || null,
            twoHundredDayMA: parseFloat(raw['200DayMovingAverage']) || null,
            // Analyst
            analystTargetPrice: parseFloat(raw.AnalystTargetPrice) || null,
            analystRatingBuy: parseInt(raw.AnalystRatingStrongBuy || '0') + parseInt(raw.AnalystRatingBuy || '0'),
            analystRatingHold: parseInt(raw.AnalystRatingHold || '0'),
            analystRatingSell: parseInt(raw.AnalystRatingSell || '0') + parseInt(raw.AnalystRatingStrongSell || '0'),
            // Shares
            sharesOutstanding: parseFloat(raw.SharesOutstanding) || null,
            sharesFloat: parseFloat(raw.SharesFloat) || null,
            shortRatio: parseFloat(raw.ShortRatio) || null,
            shortPercentFloat: parseFloat(raw.ShortPercentFloat) || null,
        };

        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error(`[AV] Overview error for ${req.params.ticker}:`, err.message);
        next(err);
    }
});

// GET /api/av/earnings/:ticker — Earnings history & upcoming
router.get('/earnings/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const cacheKey = `earnings:${ticker.toUpperCase()}`;
        const cached = getCached(cacheKey, CACHE_TTL_LONG);
        if (cached) return res.json(cached);

        const raw = await avFetch({ function: 'EARNINGS', symbol: ticker });
        const quarterly = (raw.quarterlyEarnings || []).slice(0, 8).map(q => ({
            date: q.reportedDate || q.fiscalDateEnding,
            fiscalEnd: q.fiscalDateEnding,
            epsEstimate: parseFloat(q.estimatedEPS) || null,
            epsActual: parseFloat(q.reportedEPS) || null,
            surprise: parseFloat(q.surprise) || null,
            surprisePercent: parseFloat(q.surprisePercentage) || null,
        }));

        const annual = (raw.annualEarnings || []).slice(0, 5).map(a => ({
            fiscalEnd: a.fiscalDateEnding,
            eps: parseFloat(a.reportedEPS) || null,
        }));

        // Calculate earnings stats
        const beats = quarterly.filter(q => q.surprise !== null && q.surprise > 0).length;
        const misses = quarterly.filter(q => q.surprise !== null && q.surprise < 0).length;
        const meets = quarterly.filter(q => q.surprise !== null && q.surprise === 0).length;
        const avgSurprise = quarterly.length > 0
            ? quarterly.reduce((s, q) => s + (q.surprisePercent || 0), 0) / quarterly.length
            : 0;

        // Try to find next earnings date (most recent if in future)
        const today = new Date().toISOString().split('T')[0];
        const nextEarnings = quarterly.find(q => q.date && q.date >= today)?.date || null;

        const data = {
            symbol: ticker.toUpperCase(),
            quarterly,
            annual,
            stats: { beats, misses, meets, avgSurprise: Math.round(avgSurprise * 100) / 100, total: quarterly.length },
            nextEarningsDate: nextEarnings,
        };

        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error(`[AV] Earnings error for ${req.params.ticker}:`, err.message);
        next(err);
    }
});

// GET /api/av/news/:ticker — News & sentiment
router.get('/news/:ticker', async (req, res, next) => {
    try {
        const { ticker } = req.params;
        const cacheKey = `news:${ticker.toUpperCase()}`;
        const cached = getCached(cacheKey, CACHE_TTL_SHORT);
        if (cached) return res.json(cached);

        const raw = await avFetch({
            function: 'NEWS_SENTIMENT',
            tickers: ticker,
            limit: '10',
            sort: 'LATEST'
        });

        const articles = (raw.feed || []).slice(0, 8).map(a => {
            // Find the ticker-specific sentiment
            const tickerSentiment = (a.ticker_sentiment || []).find(
                ts => ts.ticker?.toUpperCase() === ticker.toUpperCase()
            );
            return {
                title: a.title || '',
                url: a.url || '',
                source: a.source || '',
                publishedAt: a.time_published || '',
                summary: (a.summary || '').slice(0, 200),
                bannerImage: a.banner_image || null,
                overallSentiment: a.overall_sentiment_label || 'Neutral',
                overallSentimentScore: parseFloat(a.overall_sentiment_score) || 0,
                tickerSentiment: tickerSentiment?.ticker_sentiment_label || 'Neutral',
                tickerSentimentScore: parseFloat(tickerSentiment?.ticker_sentiment_score) || 0,
                tickerRelevance: parseFloat(tickerSentiment?.relevance_score) || 0,
                topics: (a.topics || []).map(t => t.topic).slice(0, 3),
            };
        });

        // Aggregate sentiment
        const sentimentScores = articles.map(a => a.tickerSentimentScore).filter(s => s !== 0);
        const avgSentiment = sentimentScores.length > 0
            ? sentimentScores.reduce((s, v) => s + v, 0) / sentimentScores.length
            : 0;
        const sentimentLabel = avgSentiment > 0.15 ? 'Bullish'
            : avgSentiment > 0.05 ? 'Somewhat Bullish'
                : avgSentiment < -0.15 ? 'Bearish'
                    : avgSentiment < -0.05 ? 'Somewhat Bearish'
                        : 'Neutral';

        const data = {
            symbol: ticker.toUpperCase(),
            articles,
            sentiment: {
                score: Math.round(avgSentiment * 1000) / 1000,
                label: sentimentLabel,
                articlesAnalyzed: articles.length,
            }
        };

        setCache(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error(`[AV] News error for ${req.params.ticker}:`, err.message);
        next(err);
    }
});

module.exports = router;
