// core/strategy-builder.js - Strategy Builder
const { MathEngine } = require('./math-engine');
const { logger } = require('../utils/logger');

class StrategyBuilder {
    constructor(mathEngine) {
        this.math = mathEngine;
        this.strategies = [];
        this.activeStrategy = null;
        this.performanceHistory = [];
        logger.info('📈 Strategy Builder initialized');
    }
    
    async buildStrategy(params = {}) {
        const { type = 'hybrid', timeframe = '1h', instruments = ['EURUSD'] } = params;
        
        // Build strategy based on type
        let strategy = {
            id: `strategy_${Date.now()}`,
            name: `${type}_${timeframe}`,
            type: type,
            timeframe: timeframe,
            instruments: instruments,
            created: new Date(),
            rules: [],
            parameters: {},
            confidence: 0.7
        };
        
        switch (type) {
            case 'trend_following':
                strategy = await this.buildTrendFollowingStrategy(strategy);
                break;
            case 'mean_reversion':
                strategy = await this.buildMeanReversionStrategy(strategy);
                break;
            case 'breakout':
                strategy = await this.buildBreakoutStrategy(strategy);
                break;
            case 'hybrid':
            default:
                strategy = await this.buildHybridStrategy(strategy);
                break;
        }
        
        this.activeStrategy = strategy;
        this.strategies.push(strategy);
        
        logger.info(`✅ Built ${type} strategy: ${strategy.name}`);
        return strategy;
    }
    
    async buildTrendFollowingStrategy(strategy) {
        strategy.rules = [
            {
                id: 'trend_signal',
                condition: 'price_above_ema50 AND ema20_above_ema50',
                action: 'buy',
                weight: 0.4
            },
            {
                id: 'momentum_signal',
                condition: 'rsi > 50 AND macd_hist_positive',
                action: 'buy',
                weight: 0.3
            },
            {
                id: 'exit_signal',
                condition: 'price_below_ema50 OR rsi < 40',
                action: 'sell',
                weight: 0.3
            }
        ];
        
        strategy.parameters = {
            emaShort: 20,
            emaLong: 50,
            rsiThreshold: 50,
            stopLoss: 0.02,
            takeProfit: 0.04,
            maxPosition: 0.1
        };
        
        return strategy;
    }
    
    async buildMeanReversionStrategy(strategy) {
        strategy.rules = [
            {
                id: 'oversold_signal',
                condition: 'rsi < 30 AND price_below_bollinger_lower',
                action: 'buy',
                weight: 0.4
            },
            {
                id: 'overbought_signal',
                condition: 'rsi > 70 AND price_above_bollinger_upper',
                action: 'sell',
                weight: 0.4
            },
            {
                id: 'exit_signal',
                condition: 'price_approaches_ema50 OR rsi_neutral',
                action: 'exit',
                weight: 0.2
            }
        ];
        
        strategy.parameters = {
            rsiLower: 30,
            rsiUpper: 70,
            bbPeriod: 20,
            stopLoss: 0.015,
            takeProfit: 0.03,
            maxPosition: 0.08
        };
        
        return strategy;
    }
    
    async buildBreakoutStrategy(strategy) {
        strategy.rules = [
            {
                id: 'breakout_high_signal',
                condition: 'price_above_resistance AND volume_above_average',
                action: 'buy',
                weight: 0.5
            },
            {
                id: 'breakout_low_signal',
                condition: 'price_below_support AND volume_above_average',
                action: 'sell',
                weight: 0.5
            }
        ];
        
        strategy.parameters = {
            lookbackPeriod: 20,
            volumeMultiplier: 1.5,
            stopLoss: 0.025,
            takeProfit: 0.05,
            maxPosition: 0.1
        };
        
        return strategy;
    }
    
    async buildHybridStrategy(strategy) {
        strategy.rules = [
            // Trend following component
            {
                id: 'trend_buy',
                condition: 'price_above_ema50 AND ema20_above_ema50 AND rsi > 50',
                action: 'buy',
                weight: 0.3
            },
            // Mean reversion component
            {
                id: 'reversion_buy',
                condition: 'rsi < 30 AND price_below_bollinger_lower AND trend_sideways',
                action: 'buy',
                weight: 0.3
            },
            // Breakout component
            {
                id: 'breakout_buy',
                condition: 'price_above_resistance AND volume_above_average AND momentum_positive',
                action: 'buy',
                weight: 0.2
            },
            // Exit rules
            {
                id: 'exit',
                condition: 'price_above_take_profit OR price_below_stop_loss OR trend_reversal',
                action: 'exit',
                weight: 0.2
            }
        ];
        
        strategy.parameters = {
            // Trend following
            emaShort: 20,
            emaLong: 50,
            rsiThreshold: 50,
            // Mean reversion
            rsiLower: 30,
            rsiUpper: 70,
            bbPeriod: 20,
            // Breakout
            lookbackPeriod: 20,
            volumeMultiplier: 1.5,
            // Risk
            stopLoss: 0.02,
            takeProfit: 0.04,
            maxPosition: 0.1,
            // Hybrid
            trendWeight: 0.3,
            reversionWeight: 0.3,
            breakoutWeight: 0.2,
            exitWeight: 0.2
        };
        
        return strategy;
    }
    
    decide(marketState, strategy = this.activeStrategy) {
        if (!strategy) {
            return { action: 'hold', confidence: 0, reasons: ['No strategy'] };
        }
        
        const scores = {
            buy: 0,
            sell: 0,
            exit: 0
        };
        
        const reasons = [];
        
        // Evaluate each rule
        for (const rule of strategy.rules) {
            const evaluation = this.evaluateRule(rule, marketState);
            if (evaluation.triggered) {
                scores[rule.action] += rule.weight;
                reasons.push(evaluation.reason);
            }
        }
        
        // Determine action
        const maxScore = Math.max(scores.buy, scores.sell, scores.exit);
        let action = 'hold';
        let confidence = 0;
        
        if (maxScore > 0) {
            if (scores.buy >= scores.sell && scores.buy >= scores.exit) {
                action = 'buy';
                confidence = scores.buy;
            } else if (scores.sell >= scores.buy && scores.sell >= scores.exit) {
                action = 'sell';
                confidence = scores.sell;
            } else if (scores.exit > 0) {
                action = 'exit';
                confidence = scores.exit;
            }
        }
        
        // Apply minimum confidence threshold
        if (confidence < 0.2) {
            action = 'hold';
            confidence = 0;
        }
        
        // Apply strategy confidence
        confidence = confidence * strategy.confidence;
        
        // Log decision
        logger.debug(`Decision: ${action} (confidence: ${confidence.toFixed(2)}) - ${reasons.join(', ')}`);
        
        return {
            action: action,
            confidence: confidence,
            reasons: reasons,
            scores: scores
        };
    }
    
    evaluateRule(rule, marketState) {
        let triggered = false;
        let reason = rule.id;
        
        try {
            // This is a simplified evaluation - in production, you'd use a proper rule engine
            const conditions = rule.condition.split(' AND ');
            let allTrue = true;
            
            for (const condition of conditions) {
                const result = this.evaluateCondition(condition, marketState);
                if (!result) {
                    allTrue = false;
                    break;
                }
            }
            
            triggered = allTrue;
            
        } catch (error) {
            logger.error(`Error evaluating rule ${rule.id}:`, error);
        }
        
        return { triggered, reason };
    }
    
    evaluateCondition(condition, marketState) {
        // Simplified condition evaluation
        switch (condition) {
            case 'price_above_ema50':
                return marketState.price > marketState.ema50;
            case 'ema20_above_ema50':
                return marketState.ema20 > marketState.ema50;
            case 'rsi > 50':
                return marketState.rsi > 50;
            case 'rsi < 30':
                return marketState.rsi < 30;
            case 'rsi > 70':
                return marketState.rsi > 70;
            case 'price_below_bollinger_lower':
                return marketState.price < marketState.bollingerLower;
            case 'price_above_bollinger_upper':
                return marketState.price > marketState.bollingerUpper;
            case 'price_above_resistance':
                return marketState.resistance && marketState.resistance.length > 0 &&
                       marketState.price > marketState.resistance[0].price;
            case 'price_below_support':
                return marketState.support && marketState.support.length > 0 &&
                       marketState.price < marketState.support[0].price;
            case 'volume_above_average':
                return marketState.volume > marketState.volumeAverage;
            case 'macd_hist_positive':
                return marketState.macd && marketState.macd.histogram &&
                       marketState.macd.histogram[marketState.macd.histogram.length - 1] > 0;
            case 'trend_sideways':
                return marketState.trend === 'sideways';
            case 'momentum_positive':
                return marketState.momentum > 0;
            case 'trend_reversal':
                return false; // Complex logic needed
            default:
                return false;
        }
    }
    
    async updateStrategy(performance) {
        // Update strategy based on performance
        this.performanceHistory.push(performance);
        
        // If we have enough history, optimize
        if (this.performanceHistory.length >= 30) {
            await this.optimize(this.activeStrategy);
        }
        
        // Adjust confidence based on performance
        if (this.activeStrategy) {
            const winRate = performance.winRate || 0;
            this.activeStrategy.confidence = 0.5 + (winRate - 0.5) * 0.5;
        }
    }
    
    async optimize(strategy) {
        logger.info('🔄 Optimizing strategy...');
        
        // Use genetic algorithm to optimize parameters
        // Simplified version - in production, use proper optimization
        
        const bestParams = await this.geneticOptimization(strategy);
        strategy.parameters = { ...strategy.parameters, ...bestParams };
        
        logger.info('✅ Strategy optimized');
        return strategy;
    }
    
    async geneticOptimization(strategy) {
        // Simplified genetic algorithm
        const generations = 10;
        const populationSize = 20;
        
        let population = [];
        for (let i = 0; i < populationSize; i++) {
            population.push(this.mutateStrategy(strategy));
        }
        
        for (let gen = 0; gen < generations; gen++) {
            const scores = await this.evaluatePopulation(population);
            const ranked = population.map((p, i) => ({ strategy: p, score: scores[i] }))
                                     .sort((a, b) => b.score - a.score);
            
            // Select top 20%
            const top = ranked.slice(0, Math.floor(populationSize * 0.2));
            
            // Crossover
            const newPopulation = [];
            while (newPopulation.length < populationSize) {
                const parent1 = top[Math.floor(Math.random() * top.length)].strategy;
                const parent2 = top[Math.floor(Math.random() * top.length)].strategy;
                const child = this.crossover(parent1, parent2);
                newPopulation.push(this.mutateStrategy(child));
            }
            
            population = newPopulation;
        }
        
        // Return best parameters
        const best = population[0];
        return best.parameters;
    }
    
    mutateStrategy(strategy) {
        const mutated = JSON.parse(JSON.stringify(strategy));
        const paramKeys = Object.keys(mutated.parameters);
        const key = paramKeys[Math.floor(Math.random() * paramKeys.length)];
        
        // Mutate parameter by ±10%
        if (typeof mutated.parameters[key] === 'number') {
            const change = (Math.random() - 0.5) * 0.2;
            mutated.parameters[key] *= (1 + change);
            mutated.parameters[key] = Math.max(0, mutated.parameters[key]);
        }
        
        return mutated;
    }
    
    crossover(parent1, parent2) {
        const child = JSON.parse(JSON.stringify(parent1));
        const paramKeys = Object.keys(child.parameters);
        
        for (const key of paramKeys) {
            if (Math.random() < 0.5) {
                child.parameters[key] = parent2.parameters[key];
            }
        }
        
        return child;
    }
    
    async evaluatePopulation(population) {
        // Simplified evaluation using backtesting
        const scores = population.map(() => 0.5 + Math.random() * 0.5);
        return scores;
    }
}

module.exports = { StrategyBuilder };
