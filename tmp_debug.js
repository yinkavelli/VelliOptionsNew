require('dotenv').config();
const API_KEY = process.env.MASSIVE_API_KEY;
console.log('API key present:', !!API_KEY);

fetch(`https://api.massive.com/v3/snapshot/options/AAPL?limit=2`, {
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'application/json' }
})
    .then(r => r.json())
    .then(d => {
        const r = d.results?.[0];
        if (!r) { console.log('No results'); return; }
        console.log('\n=== RAW KEYS ===');
        console.log(Object.keys(r));
        console.log('\n=== last_quote ===');
        console.log(JSON.stringify(r.last_quote, null, 2));
        console.log('\n=== day ===');
        console.log(JSON.stringify(r.day, null, 2));
        console.log('\n=== Key fields ===');
        console.log('bid:', r.last_quote?.bid);
        console.log('ask:', r.last_quote?.ask);
        console.log('midpoint:', r.last_quote?.midpoint);
        console.log('last_trade:', JSON.stringify(r.last_quote?.last_trade));
    })
    .catch(e => console.error('Error:', e.message));
