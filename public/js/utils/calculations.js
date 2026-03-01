// ===== STRATEGY INTELLIGENCE ENGINE =====

import { daysToExpiration, formatCurrency, formatPercent } from './formatters.js';

// Strategy types with their criteria — widened for Starter tier data quality
const STRATEGY_DEFS = {
    BULL_PUT_SPREAD: {
        name: 'Bull Put Spread',
        type: 'Credit Vertical',
        subtitle: 'High Probability Credit Strategy',
        minPOP: 55,
        dteRange: [14, 90],
        shortDeltaRange: [0.10, 0.35]
    },
    BEAR_CALL_SPREAD: {
        name: 'Bear Call Spread',
        type: 'Credit Vertical',
        subtitle: 'Bearish Credit Strategy',
        minPOP: 55,
        dteRange: [14, 90],
        shortDeltaRange: [0.10, 0.35]
    },
    BULL_CALL_SPREAD: {
        name: 'Bull Call Spread',
        type: 'Debit Vertical',
        subtitle: 'Bullish Directional Spread',
        minPOP: 40,
        dteRange: [14, 90],
        longDeltaRange: [0.40, 0.60]
    },
    BEAR_PUT_SPREAD: {
        name: 'Bear Put Spread',
        type: 'Debit Vertical',
        subtitle: 'Bearish Directional Spread',
        minPOP: 40,
        dteRange: [14, 90],
        longDeltaRange: [0.40, 0.60]
    },
    IRON_CONDOR: {
        name: 'Iron Condor',
        type: 'Credit Neutral',
        subtitle: 'Range-Bound Premium Collection',
        minPOP: 55,
        dteRange: [20, 90],
        shortDeltaRange: [0.10, 0.25]
    },
    LONG_CALL: {
        name: 'Long Call',
        type: 'Debit Directional',
        subtitle: 'Bullish Directional Position',
        minPOP: 40,
        dteRange: [30, 120],
        longDeltaRange: [0.50, 0.80]
    },
    LONG_PUT: {
        name: 'Long Put',
        type: 'Debit Directional',
        subtitle: 'Bearish Directional Position',
        minPOP: 40,
        dteRange: [30, 120],
        longDeltaRange: [0.50, 0.80]
    }
};

function estimatePOP(shortDelta) {
    return Math.round((1 - Math.abs(shortDelta)) * 100);
}

function calcPayoff(strategy) {
    const { type, legs } = strategy;
    const points = [];
    const underlyingPrice = legs[0]?.underlyingPrice || 0;
    const priceLow = underlyingPrice * 0.8;
    const priceHigh = underlyingPrice * 1.2;
    const step = (priceHigh - priceLow) / 100;

    for (let price = priceLow; price <= priceHigh; price += step) {
        let pnl = 0;
        legs.forEach(leg => {
            const intrinsic = leg.contractType === 'call'
                ? Math.max(0, price - leg.strikePrice)
                : Math.max(0, leg.strikePrice - price);

            if (leg.side === 'buy') {
                pnl += (intrinsic - leg.premium) * leg.quantity * 100;
            } else {
                pnl += (leg.premium - intrinsic) * leg.quantity * 100;
            }
        });
        points.push({ price: Math.round(price * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
    }

    return points;
}

// Theoretical option price estimator using greeks and IV
// The Massive Starter tier provides greeks + IV but NOT bid/ask quotes.
// We use a closed-form approximation to generate consistent, comparable premiums.
function theoreticalPrice(contract, underlyingPrice) {
    const delta = Math.abs(contract.greeks?.delta || 0);
    const iv = normalizeIV(contract.impliedVolatility) || 0.30;
    const dte = contract.dte || daysToExpiration(contract.expirationDate);
    const strike = contract.strikePrice || 0;
    const S = underlyingPrice || strike; // use strike as proxy if no underlying

    if (!strike || !dte || delta === 0) return 0;

    const T = dte / 365;
    const sqrtT = Math.sqrt(T);

    // For ITM options (delta > 0.5): intrinsic + time value
    if (delta > 0.5) {
        const type = contract.contractType;
        const intrinsic = type === 'call'
            ? Math.max(0, S - strike)
            : Math.max(0, strike - S);
        // Time value component scales with IV and sqrt(T)
        const timeValue = S * iv * sqrtT * 0.4 * (1 - delta) * 2;
        return Math.max(0.05, Math.round((intrinsic + timeValue) * 100) / 100);
    }

    // For OTM options (delta <= 0.5): pure time value
    // Premium ≈ S * iv * sqrt(T) * f(delta) where f maps delta to a premium factor
    // Using: premium = S * iv * sqrtT * delta * scaleFactor
    // Scale factor calibrated to produce realistic OTM premiums
    const scaleFactor = 1.0;
    const premium = S * iv * sqrtT * delta * scaleFactor;
    return Math.max(0.05, Math.round(premium * 100) / 100);
}

// Get usable price for strategy calculations
function getPrice(contract, side, underlyingPrice) {
    // 1. Real bid/ask (not available on Starter tier, but check anyway)
    if (side === 'sell' && contract.bid && contract.bid > 0.05) return contract.bid;
    if (side === 'buy' && contract.ask && contract.ask > 0.05) return contract.ask;

    // 2. Use lastPrice with simulated spread (reliable within focused expiration windows)
    if (contract.lastPrice && contract.lastPrice > 0.05) {
        return side === 'sell' ? contract.lastPrice * 0.95 : contract.lastPrice * 1.05;
    }

    // 3. Fall back to theoretical pricing
    const theo = theoreticalPrice(contract, underlyingPrice);
    return side === 'sell' ? theo * 0.95 : theo * 1.05;
}

// Helper: normalize IV (Massive returns as percentage like 17.5, convert to decimal 0.175)
function normalizeIV(iv) {
    if (iv === null || iv === undefined) return null;
    return iv > 1 ? iv / 100 : iv;
}

function buildVerticalSpread(contracts, type, underlyingPrice) {
    const strategies = [];
    const expirations = [...new Set(contracts.map(c => c.expirationDate).filter(Boolean))];

    expirations.forEach(exp => {
        const dte = daysToExpiration(exp);
        const expContracts = contracts.filter(c => c.expirationDate === exp);

        if (type === 'BULL_PUT_SPREAD') {
            const def = STRATEGY_DEFS.BULL_PUT_SPREAD;
            if (dte < def.dteRange[0] || dte > def.dteRange[1]) return;

            const puts = expContracts.filter(c => c.contractType === 'put');
            puts.forEach(shortPut => {
                const shortDelta = Math.abs(shortPut.greeks?.delta || 0);
                if (shortDelta < def.shortDeltaRange[0] || shortDelta > def.shortDeltaRange[1]) return;
                const shortPrice = getPrice(shortPut, 'sell', underlyingPrice);
                if (!shortPrice || shortPrice <= 0) return;

                const widths = [2.5, 5, 10];
                widths.forEach(w => {
                    const longPut = puts.find(p =>
                        Math.abs(p.strikePrice - (shortPut.strikePrice - w)) < 0.01 &&
                        getPrice(p, 'buy', underlyingPrice) > 0
                    );
                    if (!longPut) return;
                    const longPrice = getPrice(longPut, 'buy', underlyingPrice);

                    const credit = shortPrice - longPrice;
                    if (credit <= 0) return;
                    const maxRisk = w - credit;
                    if (maxRisk <= 0) return;
                    if (credit / maxRisk < 0.05) return;

                    const pop = estimatePOP(shortPut.greeks?.delta || 0);
                    if (pop < def.minPOP) return;

                    const breakeven = shortPut.strikePrice - credit;
                    const netTheta = (shortPut.greeks?.theta || 0) - (longPut.greeks?.theta || 0);
                    const netDelta = (shortPut.greeks?.delta || 0) - (longPut.greeks?.delta || 0);
                    const netGamma = (shortPut.greeks?.gamma || 0) - (longPut.greeks?.gamma || 0);
                    const netVega = (shortPut.greeks?.vega || 0) - (longPut.greeks?.vega || 0);

                    strategies.push({
                        id: `bps_${exp}_${shortPut.strikePrice}_${longPut.strikePrice}`,
                        ...def,
                        legs: [
                            { side: 'sell', contractType: 'put', strikePrice: shortPut.strikePrice, premium: shortPrice, quantity: 1, ticker: shortPut.ticker, greeks: shortPut.greeks, underlyingPrice },
                            { side: 'buy', contractType: 'put', strikePrice: longPut.strikePrice, premium: longPrice, quantity: 1, ticker: longPut.ticker, greeks: longPut.greeks, underlyingPrice }
                        ],
                        expiration: exp, dte, credit, maxRisk, maxProfit: credit, breakeven, pop,
                        greeks: { delta: netDelta, theta: Math.abs(netTheta), gamma: netGamma, vega: netVega },
                        iv: normalizeIV(shortPut.impliedVolatility), width: w
                    });
                });
            });
        }

        if (type === 'BEAR_CALL_SPREAD') {
            const def = STRATEGY_DEFS.BEAR_CALL_SPREAD;
            if (dte < def.dteRange[0] || dte > def.dteRange[1]) return;

            const calls = expContracts.filter(c => c.contractType === 'call');
            calls.forEach(shortCall => {
                const shortDelta = Math.abs(shortCall.greeks?.delta || 0);
                if (shortDelta < def.shortDeltaRange[0] || shortDelta > def.shortDeltaRange[1]) return;
                const shortPrice = getPrice(shortCall, 'sell', underlyingPrice);
                if (!shortPrice || shortPrice <= 0) return;

                const widths = [2.5, 5, 10];
                widths.forEach(w => {
                    const longCall = calls.find(c =>
                        Math.abs(c.strikePrice - (shortCall.strikePrice + w)) < 0.01 &&
                        getPrice(c, 'buy', underlyingPrice) > 0
                    );
                    if (!longCall) return;
                    const longPrice = getPrice(longCall, 'buy', underlyingPrice);

                    const credit = shortPrice - longPrice;
                    if (credit <= 0) return;
                    const maxRisk = w - credit;
                    if (maxRisk <= 0) return;
                    if (credit / maxRisk < 0.05) return;

                    const pop = estimatePOP(shortCall.greeks?.delta || 0);
                    if (pop < def.minPOP) return;

                    const breakeven = shortCall.strikePrice + credit;
                    const netTheta = (shortCall.greeks?.theta || 0) - (longCall.greeks?.theta || 0);
                    const netDelta = (shortCall.greeks?.delta || 0) - (longCall.greeks?.delta || 0);

                    strategies.push({
                        id: `bcs_${exp}_${shortCall.strikePrice}_${longCall.strikePrice}`,
                        ...def,
                        legs: [
                            { side: 'sell', contractType: 'call', strikePrice: shortCall.strikePrice, premium: shortPrice, quantity: 1, ticker: shortCall.ticker, greeks: shortCall.greeks, underlyingPrice },
                            { side: 'buy', contractType: 'call', strikePrice: longCall.strikePrice, premium: longPrice, quantity: 1, ticker: longCall.ticker, greeks: longCall.greeks, underlyingPrice }
                        ],
                        expiration: exp, dte, credit, maxRisk, maxProfit: credit, breakeven, pop,
                        greeks: { delta: netDelta, theta: Math.abs(netTheta), gamma: 0, vega: 0 },
                        iv: normalizeIV(shortCall.impliedVolatility), width: w
                    });
                });
            });
        }

        if (type === 'IRON_CONDOR') {
            const def = STRATEGY_DEFS.IRON_CONDOR;
            if (dte < def.dteRange[0] || dte > def.dteRange[1]) return;

            const puts = expContracts.filter(c => c.contractType === 'put');
            const calls = expContracts.filter(c => c.contractType === 'call');

            puts.forEach(shortPut => {
                const putDelta = Math.abs(shortPut.greeks?.delta || 0);
                if (putDelta < def.shortDeltaRange[0] || putDelta > def.shortDeltaRange[1]) return;
                const shortPutPrice = getPrice(shortPut, 'sell', underlyingPrice);
                if (!shortPutPrice) return;

                calls.forEach(shortCall => {
                    if (shortCall.strikePrice <= shortPut.strikePrice) return;
                    const callDelta = Math.abs(shortCall.greeks?.delta || 0);
                    if (callDelta < def.shortDeltaRange[0] || callDelta > def.shortDeltaRange[1]) return;
                    const shortCallPrice = getPrice(shortCall, 'sell', underlyingPrice);
                    if (!shortCallPrice) return;

                    const width = 5;
                    const longPut = puts.find(p => Math.abs(p.strikePrice - (shortPut.strikePrice - width)) < 0.01 && getPrice(p, 'buy', underlyingPrice) > 0);
                    const longCall = calls.find(c => Math.abs(c.strikePrice - (shortCall.strikePrice + width)) < 0.01 && getPrice(c, 'buy', underlyingPrice) > 0);
                    if (!longPut || !longCall) return;

                    const longPutPrice = getPrice(longPut, 'buy', underlyingPrice);
                    const longCallPrice = getPrice(longCall, 'buy', underlyingPrice);
                    const putCredit = shortPutPrice - longPutPrice;
                    const callCredit = shortCallPrice - longCallPrice;
                    const totalCredit = putCredit + callCredit;
                    if (totalCredit <= 0) return;

                    const maxRisk = width - totalCredit;
                    if (maxRisk <= 0) return;
                    if (totalCredit / maxRisk < 0.25) return;

                    const pop = Math.round((1 - (Math.abs(shortPut.greeks?.delta || 0) + Math.abs(shortCall.greeks?.delta || 0))) * 100);
                    if (pop < def.minPOP) return;

                    strategies.push({
                        id: `ic_${exp}_${shortPut.strikePrice}_${shortCall.strikePrice}`,
                        ...def,
                        legs: [
                            { side: 'buy', contractType: 'put', strikePrice: longPut.strikePrice, premium: longPutPrice, quantity: 1, ticker: longPut.ticker, underlyingPrice },
                            { side: 'sell', contractType: 'put', strikePrice: shortPut.strikePrice, premium: shortPutPrice, quantity: 1, ticker: shortPut.ticker, underlyingPrice },
                            { side: 'sell', contractType: 'call', strikePrice: shortCall.strikePrice, premium: shortCallPrice, quantity: 1, ticker: shortCall.ticker, underlyingPrice },
                            { side: 'buy', contractType: 'call', strikePrice: longCall.strikePrice, premium: longCallPrice, quantity: 1, ticker: longCall.ticker, underlyingPrice }
                        ],
                        expiration: exp, dte, credit: totalCredit, maxRisk, maxProfit: totalCredit,
                        breakeven: `${(shortPut.strikePrice - totalCredit).toFixed(2)} / ${(shortCall.strikePrice + totalCredit).toFixed(2)}`,
                        pop,
                        greeks: { delta: 0, theta: Math.abs((shortPut.greeks?.theta || 0) + (shortCall.greeks?.theta || 0)), gamma: 0, vega: 0 },
                        iv: normalizeIV(((shortPut.impliedVolatility || 0) + (shortCall.impliedVolatility || 0)) / 2),
                        width
                    });
                });
            });
        }
    });

    return strategies;
}

function scoreStrategy(strategy) {
    let score = 0;

    // POP (30% weight)
    score += (strategy.pop / 100) * 30;

    // Risk/Reward (25% weight) — higher credit/maxRisk = better
    const rr = strategy.credit / (strategy.maxRisk || 1);
    score += Math.min(rr * 25, 25);

    // Theta efficiency (15% weight) — theta per dollar of risk
    const thetaEff = (strategy.greeks?.theta || 0) / (strategy.maxRisk || 1);
    score += Math.min(thetaEff * 150, 15);

    // Liquidity placeholder (15% weight) — we assume decent if it passed filters
    score += 10;

    // IV environment (15% weight) — mid-range IV gets highest score
    const ivPct = (strategy.iv || 0) * 100; // iv is already normalized to decimal
    if (ivPct >= 25 && ivPct <= 60) score += 15;
    else if (ivPct >= 15 && ivPct <= 80) score += 10;
    else score += 5;

    return Math.round(Math.min(score, 100));
}

export function analyzeOptions(contracts, underlyingPrice) {
    if (!contracts || contracts.length === 0) return [];

    const allStrategies = [];

    // Build vertical spreads
    const types = ['BULL_PUT_SPREAD', 'BEAR_CALL_SPREAD', 'IRON_CONDOR'];
    types.forEach(type => {
        const results = buildVerticalSpread(contracts, type, underlyingPrice);
        allStrategies.push(...results);
    });

    // Score and filter
    const scored = allStrategies.map(s => ({
        ...s,
        score: scoreStrategy(s),
        payoff: calcPayoff(s)
    }));

    // Filter >= 40 and sort by score
    return scored
        .filter(s => s.score >= 40)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Top 10
}

export function generateExplainer(strategy) {
    const { name, dte, legs, pop, greeks, iv, credit, maxRisk, breakeven } = strategy;
    const explainers = [];

    // Why this maturity?
    explainers.push({
        question: `Why this maturity (${dte} DTE)?`,
        answer: dte <= 45
            ? `Options lose the most value in the final 30-45 days before expiration. With ${dte} days left, you capture the steepest part of the time decay curve — your Theta of +$${(greeks.theta * 100).toFixed(0)}/day means the position gains value each day just from time passing. This is known as "selling time" and is one of the most consistent edges in options trading.`
            : `Longer-dated options (${dte} days) give the trade more time to work in your favor. While time decay is slower, the position has a higher probability of finishing profitable because the underlying has more time to move in your direction.`
    });

    // Why these strikes?
    const sellLeg = legs.find(l => l.side === 'sell');
    const buyLeg = legs.find(l => l.side === 'buy' && l.contractType === sellLeg?.contractType);
    if (sellLeg && buyLeg) {
        const deltaEstimate = Math.round((1 - Math.abs(sellLeg.greeks?.delta || 0)) * 100);
        explainers.push({
            question: `Why these strikes (${sellLeg.strikePrice}/${buyLeg.strikePrice})?`,
            answer: `The short ${sellLeg.strikePrice} strike has a delta of ${(sellLeg.greeks?.delta || 0).toFixed(2)}, meaning there's roughly a ${deltaEstimate}% chance the stock stays ${sellLeg.contractType === 'put' ? 'above' : 'below'} this price at expiration. The ${buyLeg.strikePrice} long ${buyLeg.contractType} limits your maximum loss to ${formatCurrency(maxRisk)} per share. The ${Math.abs(sellLeg.strikePrice - buyLeg.strikePrice)}-point width balances premium collected against risk.`
        });
    }

    // Why this strategy type?
    const ivPct = (iv || 0) * 100;
    const isCredit = credit > 0;
    explainers.push({
        question: 'Why this strategy type?',
        answer: isCredit
            ? `With IV at ${ivPct.toFixed(1)}% — ${ivPct > 50 ? 'elevated, meaning options are expensive' : ivPct > 30 ? 'in the sweet spot for premium selling' : 'relatively low, but still tradeable'} — the ${name} collects premium upfront. It benefits from time decay (positive Theta), which works in your favor every day. ${pop >= 65 ? `With a ${pop}% probability of profit, the odds are in your favor, though always remember past probabilities don't guarantee future results.` : ''}`
            : `This directional strategy uses defined risk to capture movement in the underlying. Your maximum loss is limited to the premium paid, while your potential gain is defined by the spread width.`
    });

    return explainers;
}

export const GREEK_TOOLTIPS = {
    delta: (val) => `Delta measures directional exposure. ${val < 0 ? `Your delta of ${val.toFixed(2)} means for every $1 the stock moves up, this position gains ~$${Math.abs(val).toFixed(2)}` : `A delta of ${val.toFixed(2)} gives you directional exposure to upward moves`}. Short legs between 0.15-0.30 delta capture 1-2 standard deviation moves.`,
    theta: (val) => `Theta represents daily time decay. ${val >= 0 ? `+$${(val * 100).toFixed(0)}/day means this position gains value each day as expiration approaches. Positive theta is ideal for credit spreads — time is on your side.` : `This position loses $${Math.abs(val * 100).toFixed(0)}/day to time decay. Consider managing the position before decay accelerates.`}`,
    gamma: (val) => `Gamma measures how fast delta changes. ${Math.abs(val) < 0.05 ? 'Low gamma means your risk profile stays stable — ideal for credit strategies.' : 'Higher gamma means delta shifts faster, which can cause rapid P&L swings near expiration.'}`,
    vega: (val) => `Vega measures IV sensitivity. ${val < 0 ? 'Negative vega means this position benefits when implied volatility decreases — falling IV reduces the value of options you sold.' : 'Positive vega means this position benefits from rising implied volatility.'}`
};
