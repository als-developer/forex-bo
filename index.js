// index.js - Forex Trading Bot
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const cron = require('node-cron');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config();

// Import core modules
const { MathEngine } = require('./core/math-engine');
const { Indicators } = require('./core/indicators');
const { StrategyBuilder } = require('./core/strategy-builder');
const { RiskManager } = require('./core/risk-manager');
const { Backtester } = require('./core/backtester');
const { ForexAPI } = require('./api/forex-api');
const { MarketData } = require('./api/market-data');
const { SymbolicRegressor } = require('./ai/symbolic-regressor');
const { LearningEngine } = require('./ai/learning-engine');
const { logger } = require('./utils/logger');
const { config } = require('./config/trading-config');

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// ============================================
// INITIALIZE BOT COMPONENTS
// ============================================

class ForexTradingBot {
    constructor() {
        this.isRunning = false;
        this.currentPosition = null;
        this.tradingHistory = [];
        this.performance = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            winRate: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            sharpeRatio: 0
        };
        
        // Initialize components
        this.mathEngine = new MathEngine();
        this.indicators = new Indicators();
        this.strategyBuilder = new StrategyBuilder(this.mathEngine);
        this.riskManager = new RiskManager(this.mathEngine);
        this.backtester = new Backtester(this);
        this.forexAPI = new ForexAPI(config.api);
        this.marketData = new MarketData(this.forexAPI);
        this.symbolicRegressor = new SymbolicRegressor(this.mathEngine);
        this.learningEngine = new LearningEngine();
        
        this.strategy = null;
        this.lastMarketState = null;
        this.models = {};
        
        logger.info('🤖 Forex Trading Bot initialized');
    }
    
    async start() {
        try {
            logger.info('🚀 Starting Forex Trading Bot...');
            
            // Connect to Forex API
            await this.forexAPI.connect();
            logger.info('✅ Connected to Forex API');
            
            // Load or generate initial strategy
            this.strategy = await this.strategyBuilder.buildStrategy({
                type: 'hybrid',
                timeframe: '1h',
                instruments: config.instruments
            });
            logger.info('✅ Trading strategy loaded');
            
            // Initialize learning engine
            await this.learningEngine.initialize();
            
            // Start market data stream
            await this.marketData.startStream(this.handleMarketData.bind(this));
            
            // Schedule regular tasks
            this.scheduleTasks();
            
            this.isRunning = true;
            logger.info('✅ Forex bot is running!');
            
            // Emit status update
            io.emit('bot_status', { status: 'running', timestamp: new Date() });
            
            return true;
            
        } catch (error) {
            logger.error('❌ Failed to start bot:', error);
            throw error;
        }
    }
    
    async stop() {
        logger.info('🛑 Stopping Forex Trading Bot...');
        this.isRunning = false;
        
        await this.marketData.stopStream();
        await this.forexAPI.disconnect();
        
        io.emit('bot_status', { status: 'stopped', timestamp: new Date() });
        logger.info('✅ Bot stopped successfully');
    }
    
    // ============================================
    // MARKET DATA HANDLER
    // ============================================
    
    async handleMarketData(data) {
        try {
            const { symbol, price, volume, timestamp } = data;
            
            // Update indicators
            const indicators = this.indicators.calculateAll(data);
            
            // Get market state
            const marketState = this.analyzeMarketState(data, indicators);
            this.lastMarketState = marketState;
            
            // Check if we need to act
            if (this.shouldTrade(marketState)) {
                await this.executeTrade(marketState);
            }
            
            // Update risk management
            await this.riskManager.update(marketState);
            
            // Emit real-time data
            io.emit('market_data', {
                symbol,
                price,
                indicators,
                marketState,
                timestamp
            });
            
        } catch (error) {
            logger.error('Error handling market data:', error);
        }
    }
    
    // ============================================
    // MARKET ANALYSIS
    // ============================================
    
    analyzeMarketState(data, indicators) {
        // Use math engine to analyze market state
        const state = {
            trend: this.determineTrend(indicators),
            momentum: this.calculateMomentum(indicators),
            volatility: this.calculateVolatility(data),
            support: this.findSupportLevels(data),
            resistance: this.findResistanceLevels(data),
            overbought: indicators.rsi > 70,
            oversold: indicators.rsi < 30,
            volume: data.volume || 0,
            price: data.price,
            timestamp: data.timestamp
        };
        
        // Apply mathematical transformations
        state.score = this.mathEngine.calculateTradingScore(state);
        state.confidence = this.mathEngine.calculateConfidence(state, this.strategy);
        
        return state;
    }
    
    determineTrend(indicators) {
        // Use multiple indicators to determine trend
        const sma50 = indicators.sma50;
        const sma200 = indicators.sma200;
        const ema20 = indicators.ema20;
        
        if (ema20 > sma50 && sma50 > sma200) {
            return 'strong_uptrend';
        } else if (ema20 < sma50 && sma50 < sma200) {
            return 'strong_downtrend';
        } else if (ema20 > sma50) {
            return 'weak_uptrend';
        } else if (ema20 < sma50) {
            return 'weak_downtrend';
        } else {
            return 'sideways';
        }
    }
    
    calculateMomentum(indicators) {
        const { rsi, macd, stochastic } = indicators;
        
        // Combine multiple momentum indicators
        let momentum = 0;
        momentum += (rsi - 50) / 50 * 0.4;
        momentum += macd.histogram / 100 * 0.3;
        momentum += (stochastic.k - 50) / 50 * 0.3;
        
        return Math.min(Math.max(momentum, -1), 1);
    }
    
    calculateVolatility(data) {
        // Calculate ATR or standard deviation
        return this.mathEngine.calculateATR(data.prices || [], 14);
    }
    
    findSupportLevels(data) {
        // Find support levels using pivot points
        return this.mathEngine.findPivotPoints(data.prices || [], 'support');
    }
    
    findResistanceLevels(data) {
        // Find resistance levels using pivot points
        return this.mathEngine.findPivotPoints(data.prices || [], 'resistance');
    }
    
    // ============================================
    // TRADING DECISION
    // ============================================
    
    shouldTrade(marketState) {
        // Check if we should enter a trade
        if (!this.isRunning) return false;
        
        const { confidence, score } = marketState;
        
        // Minimum confidence threshold
        if (confidence < config.trading.minConfidence) return false;
        
        // Check if we already have a position
        if (this.currentPosition) return false;
        
        // Check if market is suitable for trading
        if (marketState.volatility > config.trading.maxVolatility) return false;
        
        // Use strategy to make decision
        const decision = this.strategyBuilder.decide(marketState, this.strategy);
        
        if (decision.action !== 'hold') {
            logger.info(`Trading signal: ${decision.action} with confidence ${decision.confidence}`);
            return true;
        }
        
        return false;
    }
    
    // ============================================
    // EXECUTE TRADE
    // ============================================
    
    async executeTrade(marketState) {
        try {
            const decision = this.strategyBuilder.decide(marketState, this.strategy);
            
            if (decision.action === 'hold') return;
            
            // Calculate position size
            const positionSize = this.riskManager.calculatePositionSize(
                marketState,
                this.performance,
                config.trading.maxRiskPerTrade
            );
            
            // Set stop loss and take profit
            const stopLoss = this.mathEngine.calculateStopLoss(
                marketState.price,
                decision.action,
                config.trading.stopLossPercent
            );
            
            const takeProfit = this.mathEngine.calculateTakeProfit(
                marketState.price,
                decision.action,
                config.trading.takeProfitPercent
            );
            
            // Execute trade via API
            const order = await this.forexAPI.placeOrder({
                symbol: marketState.symbol || 'EURUSD',
                action: decision.action,
                size: positionSize,
                stopLoss: stopLoss,
                takeProfit: takeProfit,
                type: 'market'
            });
            
            // Update state
            this.currentPosition = {
                orderId: order.id,
                symbol: order.symbol,
                action: order.action,
                entryPrice: order.price,
                size: order.size,
                stopLoss: order.stopLoss,
                takeProfit: order.takeProfit,
                timestamp: new Date(),
                status: 'open'
            };
            
            logger.info(`📊 Trade executed: ${order.action} ${order.size} at ${order.price}`);
            
            // Emit trade event
            io.emit('trade', {
                type: 'open',
                position: this.currentPosition,
                timestamp: new Date()
            });
            
            // Update learning
            await this.learningEngine.recordTrade(this.currentPosition, marketState);
            
            return order;
            
        } catch (error) {
            logger.error('Failed to execute trade:', error);
            throw error;
        }
    }
    
    // ============================================
    // CLOSE POSITION
    // ============================================
    
    async closePosition() {
        if (!this.currentPosition) return;
        
        try {
            const position = this.currentPosition;
            const currentPrice = await this.marketData.getCurrentPrice(position.symbol);
            
            // Calculate PnL
            const pnl = this.mathEngine.calculatePnL(position, currentPrice);
            
            // Close the position
            await this.forexAPI.closeOrder(position.orderId);
            
            // Update performance
            this.performance.totalTrades++;
            if (pnl > 0) {
                this.performance.winningTrades++;
            } else {
                this.performance.losingTrades++;
            }
            this.performance.totalProfit += pnl;
            this.performance.winRate = this.performance.winningTrades / this.performance.totalTrades;
            this.performance.profitFactor = this.calculateProfitFactor();
            
            // Store in history
            this.tradingHistory.push({
                ...position,
                exitPrice: currentPrice,
                pnl: pnl,
                exitTime: new Date()
            });
            
            // Clear current position
            this.currentPosition = null;
            
            logger.info(`📉 Position closed: PnL = ${pnl}`);
            
            // Emit trade event
            io.emit('trade', {
                type: 'close',
                position: position,
                pnl: pnl,
                timestamp: new Date()
            });
            
        } catch (error) {
            logger.error('Failed to close position:', error);
        }
    }
    
    calculateProfitFactor() {
        const profits = this.tradingHistory.filter(t => t.pnl > 0);
        const losses = this.tradingHistory.filter(t => t.pnl < 0);
        
        const totalProfit = profits.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
        
        return totalLoss === 0 ? Infinity : totalProfit / totalLoss;
    }
    
    // ============================================
    // SCHEDULED TASKS
    // ============================================
    
    scheduleTasks() {
        // Update strategy daily
        cron.schedule('0 0 * * *', async () => {
            logger.info('🔄 Updating strategy...');
            await this.strategyBuilder.updateStrategy(this.performance);
        });
        
        // Check stop loss / take profit every minute
        cron.schedule('* * * * *', async () => {
            if (this.currentPosition) {
                await this.checkPositionStatus();
            }
        });
        
        // Generate daily report
        cron.schedule('0 0 * * *', () => {
            this.generateReport();
        });
    }
    
    async checkPositionStatus() {
        if (!this.currentPosition) return;
        
        const currentPrice = await this.marketData.getCurrentPrice(this.currentPosition.symbol);
        const position = this.currentPosition;
        
        // Check stop loss
        if (position.action === 'buy' && currentPrice <= position.stopLoss) {
            await this.closePosition();
        } else if (position.action === 'sell' && currentPrice >= position.stopLoss) {
            await this.closePosition();
        }
        // Check take profit
        else if (position.action === 'buy' && currentPrice >= position.takeProfit) {
            await this.closePosition();
        } else if (position.action === 'sell' && currentPrice <= position.takeProfit) {
            await this.closePosition();
        }
    }
    
    generateReport() {
        const report = {
            timestamp: new Date(),
            performance: this.performance,
            positions: this.tradingHistory.slice(-10),
            currentPosition: this.currentPosition
        };
        
        logger.info('📊 Daily Report:', report);
        io.emit('report', report);
    }
    
    // ============================================
    // PUBLIC METHODS (API)
    // ============================================
    
    async getStatus() {
        return {
            running: this.isRunning,
            currentPosition: this.currentPosition,
            performance: this.performance,
            trades: this.tradingHistory.slice(-20),
            lastMarketState: this.lastMarketState,
            strategy: this.strategy
        };
    }
    
    async getStrategy() {
        return this.strategy;
    }
    
    async getIndicators(symbol, timeframe = '1h') {
        const data = await this.marketData.getHistoricalData(symbol, timeframe);
        return this.indicators.calculateAll(data);
    }
    
    async backtestStrategy(params) {
        return await this.backtester.run(params);
    }
    
    async optimizeStrategy(params) {
        return await this.strategyBuilder.optimize(params);
    }
}

// ============================================
// CREATE BOT INSTANCE
// ============================================

const bot = new ForexTradingBot();

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: bot.isRunning ? 'running' : 'stopped',
        version: require('./package.json').version,
        timestamp: new Date().toISOString()
    });
});

// Get bot status
app.get('/api/status', async (req, res) => {
    try {
        const status = await bot.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start bot
app.post('/api/start', async (req, res) => {
    try {
        await bot.start();
        res.json({ success: true, message: 'Bot started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop bot
app.post('/api/stop', async (req, res) => {
    try {
        await bot.stop();
        res.json({ success: true, message: 'Bot stopped' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get performance
app.get('/api/performance', async (req, res) => {
    res.json(bot.performance);
});

// Get trading history
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json(bot.tradingHistory.slice(-limit));
});

// Get current position
app.get('/api/position', (req, res) => {
    res.json(bot.currentPosition || { status: 'none' });
});

// Get indicators
app.get('/api/indicators/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { timeframe } = req.query;
        const indicators = await bot.getIndicators(symbol, timeframe);
        res.json(indicators);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get strategy
app.get('/api/strategy', async (req, res) => {
    try {
        const strategy = await bot.getStrategy();
        res.json(strategy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Run backtest
app.post('/api/backtest', async (req, res) => {
    try {
        const result = await bot.backtestStrategy(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Optimize strategy
app.post('/api/optimize', async (req, res) => {
    try {
        const result = await bot.optimizeStrategy(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Place manual trade
app.post('/api/trade', async (req, res) => {
    try {
        const { symbol, action, size, stopLoss, takeProfit } = req.body;
        const order = await bot.forexAPI.placeOrder({
            symbol,
            action,
            size,
            stopLoss,
            takeProfit,
            type: 'market',
            manual: true
        });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Close position manually
app.post('/api/close', async (req, res) => {
    try {
        await bot.closePosition();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: err.message });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
    logger.info(`🚀 Forex bot server running on port ${PORT}`);
    logger.info(`🌐 Health check: http://localhost:${PORT}/api/health`);
    
    // Auto-start if configured
    if (process.env.AUTO_START === 'true') {
        setTimeout(() => {
            bot.start().catch(err => {
                logger.error('Auto-start failed:', err);
            });
        }, 3000);
    }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    server.close(() => {
        bot.stop().finally(() => {
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    process.exit(0);
});

module.exports = { app, server, bot };
