// config/trading-config.js - Trading Configuration
module.exports = {
    config: {
        // General settings
        trading: {
            minConfidence: 0.6,
            maxVolatility: 0.02,
            maxRiskPerTrade: 0.02,
            stopLossPercent: 0.02,
            takeProfitPercent: 0.04,
            maxPositions: 5,
            maxLeverage: 10
        },
        
        // Instruments to trade
        instruments: [
            'EURUSD',
            'GBPUSD',
            'USDJPY',
            'AUDUSD',
            'USDCAD'
        ],
        
        // Timeframes
        timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
        
        // API configuration
        api: {
            provider: process.env.FOREX_PROVIDER || 'demo',
            apiKey: process.env.FOREX_API_KEY,
            apiSecret: process.env.FOREX_API_SECRET,
            accountId: process.env.FOREX_ACCOUNT_ID
        },
        
        // Database
        database: {
            url: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'true'
        },
        
        // Redis for caching
        redis: {
            url: process.env.REDIS_URL
        }
    }
};
