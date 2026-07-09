// ai/symbolic-regressor.js - Symbolic Regression
const { MathEngine } = require('../core/math-engine');
const { logger } = require('../utils/logger');

class SymbolicRegressor {
    constructor(mathEngine) {
        this.math = mathEngine;
        this.population = [];
        this.bestFitness = Infinity;
        this.bestExpression = null;
        this.generationCount = 0;
        
        logger.info('🧬 Symbolic Regressor initialized');
    }
    
    async fit(X, y, params = {}) {
        const {
            populationSize = 100,
            generations = 50,
            maxDepth = 4,
            mutationRate = 0.1,
            crossoverRate = 0.7,
            tournamentSize = 3
        } = params;
        
        logger.info('🧬 Starting symbolic regression...');
        
        // Initialize population
        this.population = [];
        for (let i = 0; i < populationSize; i++) {
            const expr = this.math.generateRandomExpression(0, maxDepth);
            const fitness = this.calculateFitness(expr, X, y);
            this.population.push({ expr, fitness });
        }
        
        // Evolution loop
        for (let gen = 0; gen < generations; gen++) {
            this.generationCount = gen;
            
            // Sort by fitness
            this.population.sort((a, b) => a.fitness - b.fitness);
            
            // Update best
            if (this.population[0].fitness < this.bestFitness) {
                this.bestFitness = this.population[0].fitness;
                this.bestExpression = this.population[0].expr;
                logger.info(`Generation ${gen}: Best fitness = ${this.bestFitness.toFixed(4)}`);
            }
            
            // Create new population
            const newPopulation = [];
            
            // Elitism (keep top 10%)
            const eliteCount = Math.floor(populationSize * 0.1);
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(this.population[i]);
            }
            
            // Generate rest
            while (newPopulation.length < populationSize) {
                const parent1 = this.tournamentSelect(tournamentSize);
                const parent2 = this.tournamentSelect(tournamentSize);
                
                let child;
                
                // Crossover
                if (Math.random() < crossoverRate) {
                    child = this.crossover(parent1.expr, parent2.expr);
                } else {
                    child = parent1.expr;
                }
                
                // Mutation
                if (Math.random() < mutationRate) {
                    child = this.mutate(child, maxDepth);
                }
                
                const fitness = this.calculateFitness(child, X, y);
                newPopulation.push({ expr: child, fitness });
            }
            
            this.population = newPopulation;
        }
        
        logger.info(`✅ Symbolic regression complete. Best expression: ${this.bestExpression}`);
        logger.info(`Best fitness: ${this.bestFitness.toFixed(4)}`);
        
        return {
            expression: this.bestExpression,
            fitness: this.bestFitness,
            generations: this.generationCount
        };
    }
    
    calculateFitness(expression, X, y) {
        let totalError = 0;
        
        for (let i = 0; i < X.length; i++) {
            try {
                const predicted = this.math.evaluateExpression(expression, X[i]);
                const actual = y[i];
                const error = Math.abs(predicted - actual);
                totalError += error;
            } catch (e) {
                // Invalid expression, punish heavily
                totalError += 1000;
            }
        }
        
        // Add complexity penalty
        const complexity = this.calculateComplexity(expression);
        const complexityPenalty = complexity * 0.01;
        
        return totalError / X.length + complexityPenalty;
    }
    
    calculateComplexity(expression) {
        // Count operators and functions
        const operators = ['+', '-', '*', '/'];
        const functions = ['sin', 'cos', 'exp', 'log', 'sqrt', 'abs'];
        
        let complexity = 1;
        for (const op of operators) {
            complexity += (expression.match(new RegExp(op, 'g')) || []).length;
        }
        for (const func of functions) {
            complexity += (expression.match(new RegExp(func, 'g')) || []).length * 2;
        }
        
        return complexity;
    }
    
    tournamentSelect(tournamentSize) {
        let best = null;
        let bestFitness = Infinity;
        
        for (let i = 0; i < tournamentSize; i++) {
            const index = Math.floor(Math.random() * this.population.length);
            const individual = this.population[index];
            if (individual.fitness < bestFitness) {
                best = individual;
                bestFitness = individual.fitness;
            }
        }
        
        return best;
    }
    
    crossover(parent1, parent2) {
        // Simple crossover: swap subtrees
        // In production, implement proper subtree crossover
        if (Math.random() < 0.5) {
            return parent1;
        } else {
            return parent2;
        }
    }
    
    mutate(expression, maxDepth) {
        // Simple mutation: regenerate a random subtree
        // In production, implement proper subtree mutation
        if (Math.random() < 0.5) {
            const newExpr = this.math.generateRandomExpression(0, maxDepth);
            return newExpr;
        }
        return expression;
    }
    
    predict(X) {
        if (!this.bestExpression) {
            throw new Error('No model trained');
        }
        
        const predictions = [];
        for (const x of X) {
            try {
                const value = this.math.evaluateExpression(this.bestExpression, x);
                predictions.push(value);
            } catch (e) {
                predictions.push(0);
            }
        }
        
        return predictions;
    }
    
    getEquation() {
        return this.bestExpression || 'No equation found';
    }
    
    getR2Score(X, y) {
        if (!this.bestExpression) {
            return 0;
        }
        
        const predictions = this.predict(X);
        const meanY = this.math.mean(y);
        
        let ssTot = 0;
        let ssRes = 0;
        
        for (let i = 0; i < y.length; i++) {
            ssTot += Math.pow(y[i] - meanY, 2);
            ssRes += Math.pow(y[i] - predictions[i], 2);
        }
        
        return 1 - (ssRes / ssTot);
    }
}

module.exports = { SymbolicRegressor };
