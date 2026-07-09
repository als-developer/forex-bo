// index.js - Forex Bot with Real Trading Logic
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Simulated market data
let marketData = {
    eurusd: 1.0875,
    gbpusd: 1.2650,
    usdjpy: 148.50,
    lastUpdate: new Date()
};

// Bot state
let botState = {
    running: false,
    trades: [],
    currentPosition: null,
    totalProfit: 0,
    tradesCount: 0,
    winRate: 0
};

// Trading strategy (simplified)
function generateSignal() {
    const rsi = 40 + Math.random() * 40; // Simulate RSI 30-70
    const macd = (Math.random() - 0.5) * 0.005;
    const price = marketData.eurusd;
    
    // Simple strategy
    if (rsi < 35 && macd > 0) {
        return { action: 'BUY', confidence: 0.7 + Math.random() * 0.2 };
    } else if (rsi > 65 && macd < 0) {
        return { action: 'SELL', confidence: 0.7 + Math.random() * 0.2 };
    } else {
        return { action: 'HOLD', confidence: 0.3 };
    }
}

// Update market data periodically
function updateMarketData() {
    const change = (Math.random() - 0.5) * 0.001;
    marketData.eurusd += change;
    marketData.lastUpdate = new Date();
    
    // Auto-trade if bot is running
    if (botState.running && !botState.currentPosition) {
        const signal = generateSignal();
        if (signal.action !== 'HOLD' && signal.confidence > 0.65) {
            executeTrade(signal);
        }
    }
}

// Execute trade
function executeTrade(signal) {
    const entryPrice = marketData.eurusd;
    const trade = {
        id: Date.now(),
        action: signal.action,
        entryPrice: entryPrice,
        size: 0.1,
        stopLoss: entryPrice * (signal.action === 'BUY' ? 0.98 : 1.02),
        takeProfit: entryPrice * (signal.action === 'BUY' ? 1.02 : 0.98),
        timestamp: new Date(),
        status: 'open'
    };
    
    botState.currentPosition = trade;
    botState.trades.push(trade);
    console.log(`📊 Trade Executed: ${signal.action} at ${entryPrice}`);
}

// Close trade and calculate profit
function closeTrade() {
    if (!botState.currentPosition) return;
    
    const position = botState.currentPosition;
    const exitPrice = marketData.eurusd;
    const profit = position.action === 'BUY' 
        ? (exitPrice - position.entryPrice) * position.size * 10000
        : (position.entryPrice - exitPrice) * position.size * 10000;
    
    botState.currentPosition.status = 'closed';
    botState.currentPosition.exitPrice = exitPrice;
    botState.currentPosition.profit = profit;
    botState.totalProfit += profit;
    botState.tradesCount++;
    
    console.log(`💰 Trade Closed: Profit = ${profit.toFixed(2)} pips`);
    botState.currentPosition = null;
}

// Run market simulation every 5 seconds
setInterval(() => {
    updateMarketData();
    
    // Check stop loss / take profit
    if (botState.currentPosition) {
        const pos = botState.currentPosition;
        const price = marketData.eurusd;
        
        if (pos.action === 'BUY') {
            if (price <= pos.stopLoss || price >= pos.takeProfit) {
                closeTrade();
            }
        } else {
            if (price >= pos.stopLoss || price <= pos.takeProfit) {
                closeTrade();
            }
        }
    }
}, 5000);

// ============================================
// API ROUTES
// ============================================

// Home
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Forex Bot is alive!',
        timestamp: new Date().toISOString()
    });
});

// Get status
app.get('/api/status', (req, res) => {
    res.json({
        running: botState.running,
        currentPosition: botState.currentPosition,
        totalProfit: botState.totalProfit,
        tradesCount: botState.tradesCount,
        winRate: botState.winRate,
        marketData: marketData
    });
});

// Start bot
app.post('/api/start', (req, res) => {
    botState.running = true;
    res.json({
        success: true,
        message: 'Bot started! Trading is now active.',
        timestamp: new Date().toISOString()
    });
});

// Stop bot
app.post('/api/stop', (req, res) => {
    botState.running = false;
    if (botState.currentPosition) {
        closeTrade();
    }
    res.json({
        success: true,
        message: 'Bot stopped. All positions closed.',
        timestamp: new Date().toISOString()
    });
});

// Get trades history
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({
        trades: botState.trades.slice(-limit),
        total: botState.trades.length,
        totalProfit: botState.totalProfit
    });
});

// Get current position
app.get('/api/position', (req, res) => {
    res.json({
        hasPosition: !!botState.currentPosition,
        position: botState.currentPosition || null
    });
});

// Manual trade
app.post('/api/trade', (req, res) => {
    const { action, size, symbol = 'EURUSD' } = req.body;
    
    if (!['BUY', 'SELL'].includes(action)) {
        return res.status(400).json({ error: 'Action must be BUY or SELL' });
    }
    
    if (botState.currentPosition) {
        return res.status(400).json({ error: 'Already have an open position' });
    }
    
    const signal = { action, confidence: 1.0 };
    executeTrade(signal);
    
    res.json({
        success: true,
        message: `Manual trade executed: ${action} ${size} ${symbol}`,
        position: botState.currentPosition
    });
});

// Close position manually
app.post('/api/close', (req, res) => {
    if (!botState.currentPosition) {
        return res.status(400).json({ error: 'No open position to close' });
    }
    
    closeTrade();
    res.json({
        success: true,
        message: 'Position closed manually',
        profit: botState.currentPosition?.profit || 0
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Forex Bot running on port ${PORT}`);
    console.log(`🌐 Visit: https://fooool-a9366cb0e56d.herokuapp.com/`);
});
