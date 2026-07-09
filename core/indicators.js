// core/indicators.js - Technical Indicators
const { MathEngine } = require('./math-engine');
const { logger } = require('../utils/logger');

class Indicators {
    constructor() {
        this.math = new MathEngine();
        this.cache = new Map();
        logger.info('📊 Indicators initialized');
    }
    
    calculateAll(data) {
        const { prices, high, low, close, volume, timestamp } = data;
        
        // Ensure we have the data we need
        const priceData = prices || close;
        if (!priceData || priceData.length < 50) {
            return this.getDefaultIndicators();
        }
        
        // Calculate all indicators
        const indicators = {
            // Trend indicators
            sma20: this.calculateSMA(priceData, 20),
            sma50: this.calculateSMA(priceData, 50),
            sma200: this.calculateSMA(priceData, 200),
            ema12: this.calculateEMA(priceData, 12),
            ema26: this.calculateEMA(priceData, 26),
            ema50: this.calculateEMA(priceData, 50),
            ema200: this.calculateEMA(priceData, 200),
            
            // Momentum indicators
            rsi: this.calculateRSI(priceData, 14),
            macd: this.calculateMACD(priceData),
            stochastic: this.calculateStochastic(high, low, close),
            
            // Volatility indicators
            bollingerBands: this.calculateBollingerBands(priceData),
            atr: this.calculateATR(high, low, close),
            
            // Volume indicators
            obv: this.calculateOBV(close, volume),
            volumeSMA: this.calculateVolumeSMA(volume),
            
            // Advanced
            fractalDimension: this.math.calculateFractalDimension(priceData),
            hurstExponent: this.math.calculateHurstExponent(priceData),
            
            // Latest values
            lastPrice: priceData[priceData.length - 1],
            priceChange: this.calculatePriceChange(priceData),
            volatility: this.calculateVolatility(priceData)
        };
        
        // Get last values
        indicators.current = {
            price: indicators.lastPrice,
            rsi: this.getLastValue(indicators.rsi),
            macd: this.getLastValue(indicators.macd?.histogram),
            sma20: this.getLastValue(indicators.sma20),
            sma50: this.getLastValue(indicators.sma50),
            ema12: this.getLastValue(indicators.ema12),
            ema26: this.getLastValue(indicators.ema26),
            bollingerUpper: this.getLastValue(indicators.bollingerBands?.upper),
            bollingerMiddle: this.getLastValue(indicators.bollingerBands?.middle),
            bollingerLower: this.getLastValue(indicators.bollingerBands?.lower),
            atr: this.getLastValue(indicators.atr),
            obv: this.getLastValue(indicators.obv),
            fractalDimension: indicators.fractalDimension,
            hurstExponent: indicators.hurstExponent
        };
        
        // Calculate trading signals
        indicators.signals = this.generateSignals(indicators);
        
        return indicators;
    }
    
    // ============================================
    // INDIVIDUAL INDICATOR METHODS
    // ============================================
    
    calculateSMA(data, period) {
        return this.math.calculateSMA(data, period);
    }
    
    calculateEMA(data, period) {
        return this.math.calculateEMA(data, period);
    }
    
    calculateRSI(data, period = 14) {
        return this.math.calculateRSI(data, period);
    }
    
    calculateMACD(data, fast = 12, slow = 26, signal = 9) {
        return this.math.calculateMACD(data, fast, slow, signal);
    }
    
    calculateBollingerBands(data, period = 20, stdDevs = 2) {
        return this.math.calculateBollingerBands(data, period, stdDevs);
    }
    
    calculateATR(high, low, close, period = 14) {
        return this.math.calculateATR(high, low, close, period);
    }
    
    calculateStochastic(high, low, close, kPeriod = 14, dPeriod = 3) {
        return this.math.calculateStochastic(high, low, close, kPeriod, dPeriod);
    }
    
    calculateOBV(close, volume) {
        if (!close || !volume || close.length !== volume.length) return null;
        
        const obv = [0];
        for (let i = 1; i < close.length; i++) {
            if (close[i] > close[i - 1]) {
                obv.push(obv[obv.length - 1] + volume[i]);
            } else if (close[i] < close[i - 1]) {
                obv.push(obv[obv.length - 1] - volume[i]);
            } else {
                obv.push(obv[obv.length - 1]);
            }
        }
        return obv;
    }
    
    calculateVolumeSMA(volume, period = 20) {
        return this.math.calculateSMA(volume, period);
    }
    
    calculatePriceChange(data) {
        if (data.length < 2) return 0;
        return (data[data.length - 1] - data[data.length - 2]) / data[data.length - 2];
    }
    
    calculateVolatility(data) {
        if (data.length < 2) return 0;
        const returns = [];
        for (let i = 1; i < data.length; i++) {
            returns.push((data[i] - data[i - 1]) / data[i - 1]);
        }
        return this.math.stdDev(returns);
    }
    
    // ============================================
    // SIGNAL GENERATION
    // ============================================
    
    generateSignals(indicators) {
        const signals = {
            buy: 0,
            sell: 0,
            hold: 0,
            strength: 0
        };
        
        // RSI signals
        if (indicators.current.rsi) {
            if (indicators.current.rsi < 30) signals.buy += 1;
            else if (indicators.current.rsi > 70) signals.sell += 1;
        }
        
        // MACD signals
        if (indicators.macd && indicators.macd.histogram) {
            const hist = indicators.macd.histogram;
            const last = hist[hist.length - 1];
            const prev = hist[hist.length - 2] || last;
            if (last > 0 && prev <= 0) signals.buy += 1;
            else if (last < 0 && prev >= 0) signals.sell += 1;
        }
        
        // Bollinger Bands signals
        if (indicators.bollingerBands) {
            const bb = indicators.bollingerBands;
            const lastUpper = bb.upper[bb.upper.length - 1];
            const lastLower = bb.lower[bb.lower.length - 1];
            const currentPrice = indicators.current.price;
            
            if (currentPrice < lastLower) signals.buy += 1;
            else if (currentPrice > lastUpper) signals.sell += 1;
        }
        
        // SMA crossover
        if (indicators.sma20 && indicators.sma50) {
            const last20 = this.getLastValue(indicators.sma20);
            const last50 = this.getLastValue(indicators.sma50);
            const prev20 = this.getSecondLastValue(indicators.sma20);
            const prev50 = this.getSecondLastValue(indicators.sma50);
            
            if (prev20 <= prev50 && last20 > last50) signals.buy += 1;
            else if (prev20 >= prev50 && last20 < last50) signals.sell += 1;
        }
        
        // Determine final signal
        if (signals.buy > signals.sell) {
            signals.action = 'buy';
            signals.strength = signals.buy / (signals.buy + signals.sell);
        } else if (signals.sell > signals.buy) {
            signals.action = 'sell';
            signals.strength = signals.sell / (signals.buy + signals.sell);
        } else {
            signals.action = 'hold';
            signals.strength = 0;
        }
        
        // Confidence level
        signals.confidence = (signals.buy + signals.sell) / 3;
        
        return signals;
    }
    
    // ============================================
    // HELPERS
    // ============================================
    
    getLastValue(array) {
        if (!array || array.length === 0) return null;
        return array[array.length - 1];
    }
    
    getSecondLastValue(array) {
        if (!array || array.length < 2) return null;
        return array[array.length - 2];
    }
    
    getDefaultIndicators() {
        return {
            current: {
                price: 0,
                rsi: 50,
                macd: 0,
                sma20: 0,
                sma50: 0,
                ema12: 0,
                ema26: 0,
                bollingerUpper: 0,
                bollingerMiddle: 0,
                bollingerLower: 0,
                atr: 0,
                obv: 0,
                fractalDimension: 1.5,
                hurstExponent: 0.5
            },
            signals: {
                action: 'hold',
                strength: 0,
                confidence: 0
            }
        };
    }
}

module.exports = { Indicators };
