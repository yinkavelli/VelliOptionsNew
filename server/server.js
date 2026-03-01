require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const marketRoutes = require('./routes/market');
const optionsRoutes = require('./routes/options');
const avRoutes = require('./routes/alphavantage');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/market', marketRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/av', avRoutes);

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        const hasKey = !!process.env.MASSIVE_API_KEY;
        const hasAV = !!process.env.ALPHA_VANTAGE_KEY;
        console.log(`\n  ⚡ Option Intel server running on:`);
        console.log(`     Local:   http://localhost:${PORT}`);
        console.log(`     Network: http://192.168.1.99:${PORT}`);
        console.log(`  🔑 Massive API Key: ${hasKey ? 'configured' : 'MISSING'}`);
        console.log(`  📊 Alpha Vantage:   ${hasAV ? 'configured' : 'MISSING'}\n`);
    });
}

// Export for Vercel
module.exports = app;
