// index.js - Forex Bot Simplified
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Forex Bot is alive!',
        timestamp: new Date().toISOString()
    });
});

// Status
app.get('/api/status', (req, res) => {
    res.json({
        running: true,
        message: 'Bot is ready',
        trades: 0,
        profit: 0
    });
});

// Start bot
app.post('/api/start', (req, res) => {
    res.json({ success: true, message: 'Bot started' });
});

// Stop bot
app.post('/api/stop', (req, res) => {
    res.json({ success: true, message: 'Bot stopped' });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Bot running on port ${PORT}`);
});
