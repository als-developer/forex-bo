// core/risk-manager.js - Risk Management
const { MathEngine } = require('./math-engine');
const { logger } = require('../utils/logger');

class RiskManager {
    constructor(mathEngine) {
        this.math = mathEngine;
        this.riskMetrics = {
            currentDrawdown: 0,
            maxDrawdown: 0,
            dailyLoss: 0,
            weeklyLoss: 0,
            monthlyLoss: 0,
            var: 0,
            cvar: 0,
            sharpeRatio: 0
        };
        
        this.positionLimits = {
            maxPositions: 5,
            maxPositionSize: 0.1,
            maxLeverage: 10,
            maxDailyTrades: 10,
            maxDailyLoss: 0.05
        };
        
        this.dailyTrades = 0;
        this.dailyPnL = 0;
        this.currentPositions = [];
        
        logger.info('🛡️ Risk Manager initialized');
    }
    
    calculatePositionSize(marketState, performance, riskPerTrade = 0.02) {
        const accountBalance = performance.accountBalance || 10000;
        
        // Calculate stop loss distance
        const stopLossDistance = this.calculateStopLossDistance(marketState);
        
        // Kelly Criterion based position sizing
        const kelly = this.math.calculateKellyCriterion(
            performance.winRate || 0.5,
            performance.avgWin || 1,
            performance.avgLoss || 1
        );
        
        // Use Kelly fraction (reduced for safety)
        const kellyFraction = Math.min(kelly, 0.25);
        
        // Calculate base position size
        let positionSize = (accountBalance * riskPerTrade) / (stopLossDistance * 10000);
        
        // Apply Kelly
        positionSize *= kellyFraction * 2;
        
        // Apply maximum position limit
        const maxPosition = accountBalance * this.positionLimits.maxPositionSize;
        positionSize = Math.min(positionSize, maxPosition);
        
        // Apply leverage limit
        const leverage = positionSize / accountBalance;
        if (leverage > this.positionLimits.maxLeverage) {
            positionSize = accountBalance * this.positionLimits.maxLeverage;
        }
        
        logger.debug(`Position size: ${positionSize} (Kelly: ${kellyFraction.toFixed(2)})`);
        
        return positionSize;
    }
    
    calculateStopLossDistance(marketState) {
        // Calculate stop loss based on volatility
        const atr = marketState.atr || 0.001;
        const currentPrice = marketState.price || 1.0;
        
        // ATR-based stop loss (2x ATR)
        const atrStop = (atr * 2) / currentPrice;
        
        // Fixed percentage stop loss (2%)
        const fixedStop = 0.02;
        
        // Use the larger of the two
        return Math.max(atrStop, fixedStop);
    }
    
    calculateTakeProfitDistance(marketState) {
        // Risk-reward ratio based take profit
        const stopDistance = this.calculateStopLossDistance(marketState);
        const riskReward = 2; // 2:1 risk-reward ratio
        
        return stopDistance * riskReward;
    }
    
    async checkPositionLimits() {
        // Check if we can open new positions
        if (this.currentPositions.length >= this.positionLimits.maxPositions) {
            return false;
        }
        
        if (this.dailyTrades >= this.positionLimits.maxDailyTrades) {
            return false;
        }
        
        if (this.dailyLoss <= -this.positionLimits.maxDailyLoss) {
            return false;
        }
        
        return true;
    }
    
    async update(marketState) {
        // Update risk metrics
        this.updateDrawdown(marketState);
        this.updateVaR(marketState);
        this.updateSharpeRatio(marketState);
        
        // Check for risk violations
        await this.checkRiskViolations();
    }
    
    updateDrawdown(marketState) {
        // Calculate current drawdown from peak
        const peak = this.getPeakEquity();
        const currentEquity = marketState.equity || 10000;
        
        if (currentEquity > peak) {
            this.riskMetrics.currentDrawdown = 0;
            this.riskMetrics.maxDrawdown = Math.max(this.riskMetrics.maxDrawdown, 0);
        } else {
            this.riskMetrics.currentDrawdown = (peak - currentEquity) / peak;
            this.riskMetrics.maxDrawdown = Math.max(
                this.riskMetrics.maxDrawdown,
                this.riskMetrics.currentDrawdown
            );
        }
        
        // Update daily loss
        if (this.dailyPnL < 0) {
            this.riskMetrics.dailyLoss = Math.abs(this.dailyPnL);
        }
    }
    
    updateVaR(marketState) {
        // Calculate Value at Risk
        if (marketState.returns && marketState.returns.length > 0) {
            this.riskMetrics.var = this.math.calculateValueAtRisk(
                marketState.returns,
                0.95,
                1
            );
            
            this.riskMetrics.cvar = this.math.calculateConditionalVaR(
                marketState.returns,
                0.95
            );
        }
    }
    
    updateSharpeRatio(marketState) {
        if (marketState.returns && marketState.returns.length > 0) {
            this.riskMetrics.sharpeRatio = this.math.calculateSharpeRatio(
                marketState.returns,
                0.02 // Risk-free rate
            );
        }
    }
    
    getPeakEquity() {
        // Get historical peak equity
        let peak = 10000; // Initial equity
        
        // In production, this would be from a database
        return peak;
    }
    
    async checkRiskViolations() {
        const violations = [];
        
        // Check max drawdown
        if (this.riskMetrics.maxDrawdown > 0.2) { // 20% max drawdown
            violations.push({
                type: 'max_drawdown',
                message: `Max drawdown exceeded: ${(this.riskMetrics.maxDrawdown * 100).toFixed(2)}%`
            });
        }
        
        // Check daily loss
        if (this.riskMetrics.dailyLoss > 0.05) { // 5% daily loss
            violations.push({
                type: 'daily_loss',
                message: `Daily loss exceeded: ${(this.riskMetrics.dailyLoss * 100).toFixed(2)}%`
            });
        }
        
        // Check Value at Risk
        if (this.riskMetrics.var > 0.03) { // 3% VaR
            violations.push({
                type: 'var',
                message: `VaR exceeded: ${(this.riskMetrics.var * 100).toFixed(2)}%`
            });
        }
        
        // Log violations
        for (const violation of violations) {
            logger.warn('⚠️ Risk violation:', violation);
        }
        
        return violations;
    }
    
    async recordTrade(trade, result) {
        // Record trade for risk management
        this.dailyTrades++;
        this.dailyPnL += result.pnl || 0;
        
        if (result.pnl > 0) {
            // Win
        } else {
            // Loss
        }
        
        // Update position list
        if (result.action === 'open') {
            this.currentPositions.push(trade);
        } else if (result.action === 'close') {
            this.currentPositions = this.currentPositions.filter(p => p.id !== trade.id);
        }
    }
    
    resetDailyMetrics() {
        this.dailyTrades = 0;
        this.dailyPnL = 0;
    }
    
    getRiskReport() {
        return {
            drawdown: this.riskMetrics.currentDrawdown,
            maxDrawdown: this.riskMetrics.maxDrawdown,
            dailyLoss: this.riskMetrics.dailyLoss,
            var: this.riskMetrics.var,
            cvar: this.riskMetrics.cvar,
            sharpeRatio: this.riskMetrics.sharpeRatio,
            positions: this.currentPositions.length,
            dailyTrades: this.dailyTrades
        };
    }
}

module.exports = { RiskManager };
