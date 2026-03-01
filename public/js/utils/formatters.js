// ===== FORMATTERS =====

export function formatCurrency(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

export function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

export function formatCompact(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1e12) return (value / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return formatNumber(value, 0);
}

export function formatPercent(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return (value >= 0 ? '+' : '') + value.toFixed(decimals) + '%';
}

export function formatChange(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return (value >= 0 ? '+' : '') + formatCurrency(value);
}

export function formatVolume(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return formatCompact(value);
}

export function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysToExpiration(dateStr) {
    if (!dateStr) return 0;
    const exp = new Date(dateStr + 'T16:00:00');
    const now = new Date();
    return Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
}

export function changeClass(value) {
    if (value === null || value === undefined) return '';
    return value >= 0 ? 'text-positive' : 'text-negative';
}

export function formatGreek(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toFixed(decimals);
}

export function formatIV(value) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    // Massive returns IV as percentage (e.g. 17.5), not decimal (0.175)
    const pct = value > 1 ? value : value * 100;
    return pct.toFixed(1) + '%';
}
