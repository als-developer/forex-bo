// core/math-engine.js - Advanced Mathematics
const math = require('mathjs');
const { logger } = require('../utils/logger');

class MathEngine {
    constructor() {
        this.constants = {
            PI: Math.PI,
            E: Math.E,
            GOLDEN_RATIO: 1.618033988749895,
            SQRT2: Math.SQRT2
        };
        
        this.fibonacci = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
        logger.info('🧮 Math Engine initialized');
    }
    
    // ============================================
    // STATISTICAL FUNCTIONS
    // ============================================
    
    mean(data) {
        return data.reduce((a, b) => a + b, 0) / data.length;
    }
    
    median(data) {
        const sorted = [...data].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
    }
    
    stdDev(data) {
        const mean = this.mean(data);
        const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
        return Math.sqrt(this.mean(squaredDiffs));
    }
    
    variance(data) {
        const mean = this.mean(data);
        const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
        return this.mean(squaredDiffs);
    }
    
    covariance(x, y) {
        const meanX = this.mean(x);
        const meanY = this.mean(y);
        const n = x.length;
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (x[i] - meanX) * (y[i] - meanY);
        }
        return sum / (n - 1);
    }
    
    correlation(x, y) {
        const cov = this.covariance(x, y);
        const stdX = this.stdDev(x);
        const stdY = this.stdDev(y);
        return cov / (stdX * stdY);
    }
    
    // ============================================
    // TECHNICAL INDICATORS MATHEMATICS
    // ============================================
    
    calculateSMA(data, period) {
        if (data.length < period) return null;
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }
    
    calculateEMA(data, period) {
        if (data.length < period) return null;
        const ema = [];
        const k = 2 / (period + 1);
        
        // Initial SMA
        const initialSMA = this.mean(data.slice(0, period));
        ema.push(initialSMA);
        
        for (let i = period; i < data.length; i++) {
            const emaValue = data[i] * k + ema[ema.length - 1] * (1 - k);
            ema.push(emaValue);
        }
        return ema;
    }
    
    calculateRSI(data, period = 14) {
        if (data.length < period + 1) return null;
        
        const changes = [];
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i] - data[i - 1]);
        }
        
        let gains = changes.slice(0, period).filter(c => c > 0);
        let losses = changes.slice(0, period).filter(c => c < 0);
        
        let avgGain = this.mean(gains) || 0;
        let avgLoss = Math.abs(this.mean(losses)) || 0;
        
        const rsi = [];
        
        for (let i = period; i < changes.length; i++) {
            const change = changes[i];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            
            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;
            
            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        
        return rsi;
    }
    
    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const emaFast = this.calculateEMA(data, fastPeriod);
        const emaSlow = this.calculateEMA(data, slowPeriod);
        
        if (!emaFast || !emaSlow) return null;
        
        // Align arrays
        const offset = data.length - emaFast.length;
        const macd = [];
        for (let i = 0; i < emaFast.length; i++) {
            macd.push(emaFast[i] - emaSlow[Math.min(i, emaSlow.length - 1)]);
        }
        
        const signal = this.calculateEMA(macd, signalPeriod);
        
        const histogram = [];
        for (let i = 0; i < macd.length; i++) {
            histogram.push(macd[i] - (signal ? signal[Math.min(i, signal.length - 1)] : 0));
        }
        
        return {
            macd,
            signal: signal || [],
            histogram
        };
    }
    
    calculateBollingerBands(data, period = 20, stdDevs = 2) {
        if (data.length < period) return null;
        
        const sma = this.calculateSMA(data, period);
        if (!sma) return null;
        
        const upper = [];
        const lower = [];
        
        for (let i = 0; i < sma.length; i++) {
            const start = i;
            const end = i + period;
            const window = data.slice(start, end);
            const std = this.stdDev(window);
            upper.push(sma[i] + stdDevs * std);
            lower.push(sma[i] - stdDevs * std);
        }
        
        return { upper, middle: sma, lower };
    }
    
    calculateATR(high, low, close, period = 14) {
        if (high.length < period) return null;
        
        const trueRanges = [];
        for (let i = 1; i < high.length; i++) {
            const h = high[i];
            const l = low[i];
            const prevClose = close[i - 1];
            
            const tr1 = h - l;
            const tr2 = Math.abs(h - prevClose);
            const tr3 = Math.abs(l - prevClose);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        return this.calculateEMA(trueRanges, period);
    }
    
    calculateStochastic(high, low, close, kPeriod = 14, dPeriod = 3) {
        if (high.length < kPeriod) return null;
        
        const kValues = [];
        for (let i = kPeriod - 1; i < close.length; i++) {
            const start = i - kPeriod + 1;
            const periodHigh = Math.max(...high.slice(start, i + 1));
            const periodLow = Math.min(...low.slice(start, i + 1));
            const k = ((close[i] - periodLow) / (periodHigh - periodLow)) * 100;
            kValues.push(k);
        }
        
        const dValues = this.calculateSMA(kValues, dPeriod);
        
        return { k: kValues, d: dValues || [] };
    }
    
    // ============================================
    // ADVANCED MATHEMATICAL FUNCTIONS
    // ============================================
    
    calculateFractalDimension(prices) {
        // Calculate fractal dimension using box-counting method
        const n = prices.length;
        const scales = [];
        const counts = [];
        
        for (let scale = 2; scale <= n / 2; scale *= 2) {
            let count = 0;
            for (let i = 0; i < n - scale; i += scale) {
                const min = Math.min(...prices.slice(i, i + scale));
                const max = Math.max(...prices.slice(i, i + scale));
                if (max - min > 0) count++;
            }
            scales.push(Math.log(1 / scale));
            counts.push(Math.log(count || 1));
        }
        
        // Linear regression to find slope (fractal dimension)
        const slope = this.linearRegression(scales, counts);
        return slope; // Return fractal dimension
    }
    
    calculateHurstExponent(prices) {
        // Calculate Hurst exponent to determine mean reversion vs trend
        const n = prices.length;
        const lags = [];
        const rs = [];
        
        for (let lag = 10; lag < n / 2; lag *= 2) {
            lags.push(Math.log(lag));
            
            const subSeries = [];
            for (let i = 0; i < n - lag; i += lag) {
                const segment = prices.slice(i, i + lag);
                const mean = this.mean(segment);
                const deviations = segment.map(x => x - mean);
                const cumSum = [];
                let sum = 0;
                for (const dev of deviations) {
                    sum += dev;
                    cumSum.push(sum);
                }
                const range = Math.max(...cumSum) - Math.min(...cumSum);
                const std = this.stdDev(segment);
                subSeries.push(range / (std || 0.0001));
            }
            
            rs.push(Math.log(this.mean(subSeries)));
        }
        
        const slope = this.linearRegression(lags, rs);
        return slope; // Return Hurst exponent
    }
    
    linearRegression(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    // ============================================
    // PIVOT POINTS
    // ============================================
    
    findPivotPoints(data, type = 'all') {
        const pivots = {
            support: [],
            resistance: []
        };
        
        // Find local minima and maxima
        for (let i = 5; i < data.length - 5; i++) {
            const left = data.slice(i - 5, i);
            const right = data.slice(i + 1, i + 6);
            
            // Check if it's a local minimum (support)
            if (data[i] <= Math.min(...left) && data[i] <= Math.min(...right)) {
                pivots.support.push({ price: data[i], index: i });
            }
            
            // Check if it's a local maximum (resistance)
            if (data[i] >= Math.max(...left) && data[i] >= Math.max(...right)) {
                pivots.resistance.push({ price: data[i], index: i });
            }
        }
        
        return type === 'support' ? pivots.support : type === 'resistance' ? pivots.resistance : pivots;
    }
    
    // ============================================
    // RISK CALCULATIONS
    // ============================================
    
    calculateValueAtRisk(returns, confidence = 0.95, horizon = 1) {
        // Historical VaR
        const sorted = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sorted.length);
        const varHistorical = sorted[index] * Math.sqrt(horizon);
        return varHistorical;
    }
    
    calculateConditionalVaR(returns, confidence = 0.95) {
        // Expected Shortfall (CVaR)
        const sorted = [...returns].sort((a, b) => a - b);
        const varThreshold = this.calculateValueAtRisk(returns, confidence);
        const tail = sorted.filter(r => r <= varThreshold);
        return this.mean(tail);
    }
    
    calculateSharpeRatio(returns, riskFreeRate = 0.02) {
        const avgReturn = this.mean(returns);
        const std = this.stdDev(returns);
        if (std === 0) return 0;
        return (avgReturn - riskFreeRate / 252) / std * Math.sqrt(252);
    }
    
    calculateMaxDrawdown(prices) {
        let maxDrawdown = 0;
        let peak = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > peak) {
                peak = prices[i];
            }
            const drawdown = (peak - prices[i]) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        
        return maxDrawdown;
    }
    
    calculateCalmarRatio(returns, prices) {
        const avgReturn = this.mean(returns);
        const maxDrawdown = this.calculateMaxDrawdown(prices);
        if (maxDrawdown === 0) return Infinity;
        return avgReturn / maxDrawdown;
    }
    
    // ============================================
    // TRADING SCORE FUNCTIONS
    // ============================================
    
    calculateTradingScore(marketState) {
        // Combine multiple factors into a trading score
        let score = 0;
        
        // Momentum factor (range: -0.5 to 0.5)
        score += marketState.momentum * 0.3;
        
        // Trend strength (range: -0.3 to 0.3)
        const trendMap = {
            'strong_uptrend': 0.3,
            'weak_uptrend': 0.15,
            'sideways': 0,
            'weak_downtrend': -0.15,
            'strong_downtrend': -0.3
        };
        score += trendMap[marketState.trend] || 0;
        
        // Overbought/Oversold (range: -0.2 to 0.2)
        if (marketState.overbought) score -= 0.2;
        if (marketState.oversold) score += 0.2;
        
        // Volatility factor (range: -0.2 to 0.2)
        const volFactor = Math.max(-0.2, Math.min(0.2, (1 - marketState.volatility / 0.02) * 0.2));
        score += volFactor;
        
        // Support/Resistance (range: -0.2 to 0.2)
        if (marketState.support && marketState.support.length > 0) {
            const nearestSupport = marketState.support[0];
            const distance = (marketState.price - nearestSupport.price) / nearestSupport.price;
            if (distance < 0.01) score += 0.1;
        }
        if (marketState.resistance && marketState.resistance.length > 0) {
            const nearestResistance = marketState.resistance[0];
            const distance = (nearestResistance.price - marketState.price) / nearestResistance.price;
            if (distance < 0.01) score -= 0.1;
        }
        
        return Math.max(-1, Math.min(1, score));
    }
    
    calculateConfidence(marketState, strategy) {
        // Calculate confidence based on multiple factors
        let confidence = 0.5;
        
        // Score confidence
        confidence += Math.abs(marketState.score) * 0.3;
        
        // Signal consistency
        const signals = this.getSignals(marketState);
        const consistentSignals = signals.filter(s => s === signals[0]).length;
        confidence += (consistentSignals / signals.length) * 0.2;
        
        // Market state confidence
        if (marketState.trend !== 'sideways') confidence += 0.1;
        if (marketState.volatility < 0.015) confidence += 0.1;
        if (marketState.overbought || marketState.oversold) confidence += 0.1;
        
        // Strategy confidence
        if (strategy && strategy.confidence) {
            confidence = (confidence + strategy.confidence) / 2;
        }
        
        return Math.min(1, Math.max(0, confidence));
    }
    
    getSignals(marketState) {
        const signals = [];
        
        // RSI signal
        if (marketState.rsi > 70) signals.push('sell');
        else if (marketState.rsi < 30) signals.push('buy');
        else signals.push('neutral');
        
        // MACD signal
        if (marketState.macd && marketState.macd.histogram) {
            const lastHist = marketState.macd.histogram[marketState.macd.histogram.length - 1];
            const prevHist = marketState.macd.histogram[marketState.macd.histogram.length - 2] || lastHist;
            if (lastHist > 0 && prevHist <= 0) signals.push('buy');
            else if (lastHist < 0 && prevHist >= 0) signals.push('sell');
            else signals.push('neutral');
        }
        
        // Bollinger Bands signal
        if (marketState.bollingerBands) {
            const bb = marketState.bollingerBands;
            const lastPrice = marketState.price;
            const lastUpper = bb.upper[bb.upper.length - 1];
            const lastLower = bb.lower[bb.lower.length - 1];
            if (lastPrice > lastUpper) signals.push('sell');
            else if (lastPrice < lastLower) signals.push('buy');
            else signals.push('neutral');
        }
        
        return signals;
    }
    
    // ============================================
    // POSITION SIZING
    // ============================================
    
    calculatePositionSize(accountBalance, riskPerTrade, stopLossDistance) {
        // Kelly Criterion based position sizing
        const riskAmount = accountBalance * riskPerTrade;
        const positionSize = riskAmount / stopLossDistance;
        return positionSize;
    }
    
    calculateKellyCriterion(winRate, avgWin, avgLoss) {
        // Kelly formula: f* = (p * b - q) / b
        const p = winRate;
        const q = 1 - p;
        const b = avgWin / avgLoss;
        const kelly = (p * b - q) / b;
        return Math.max(0, Math.min(1, kelly));
    }
    
    // ============================================
    // SYMBOLIC REGRESSION (AI)
    // ============================================
    
    generateRandomExpression(depth = 0, maxDepth = 4) {
        // Generate random mathematical expressions using genetic programming
        const operators = ['+', '-', '*', '/'];
        const functions = ['sin', 'cos', 'exp', 'log', 'sqrt', 'abs'];
        
        if (depth >= maxDepth || Math.random() < 0.3) {
            // Terminal node
            const terminals = ['x', '1', '2', '3', '5', '10', 'PI', 'E'];
            return terminals[Math.floor(Math.random() * terminals.length)];
        }
        
        const type = Math.random() < 0.5 ? 'operator' : 'function';
        
        if (type === 'operator') {
            const op = operators[Math.floor(Math.random() * operators.length)];
            const left = this.generateRandomExpression(depth + 1, maxDepth);
            const right = this.generateRandomExpression(depth + 1, maxDepth);
            return `(${left} ${op} ${right})`;
        } else {
            const func = functions[Math.floor(Math.random() * functions.length)];
            const child = this.generateRandomExpression(depth + 1, maxDepth);
            return `${func}(${child})`;
        }
    }
    
    evaluateExpression(expression, x) {
        // Evaluate mathematical expression with variable x
        const scope = { x, PI: Math.PI, E: Math.E };
        try {
            return math.evaluate(expression, scope);
        } catch (e) {
            return 0;
        }
    }
    
    // ============================================
    // HELPERS
    // ============================================
    
    normalize(array) {
        const min = Math.min(...array);
        const max = Math.max(...array);
        if (max === min) return array.map(() => 0.5);
        return array.map(x => (x - min) / (max - min));
    }
    
    standardize(array) {
        const mean = this.mean(array);
        const std = this.stdDev(array);
        if (std === 0) return array.map(() => 0);
        return array.map(x => (x - mean) / std);
    }
    
    calculatePnL(position, currentPrice) {
        if (position.action === 'buy') {
            return (currentPrice - position.entryPrice) * position.size;
        } else {
            return (position.entryPrice - currentPrice) * position.size;
        }
    }
    
    calculateStopLoss(price, action, percent) {
        if (action === 'buy') {
            return price * (1 - percent);
        } else {
            return price * (1 + percent);
        }
    }
    
    calculateTakeProfit(price, action, percent) {
        if (action === 'buy') {
            return price * (1 + percent);
        } else {
            return price * (1 - percent);
        }
    }
}

module.exports = { MathEngine };
