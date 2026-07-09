// utils/logger.js - Logging System
const winston = require('winston');
const { format } = winston;

// Custom format for console
const consoleFormat = format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
    })
);

// Custom format for files
const fileFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
);

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // File transport for errors
        new winston.transports.File({
            filename: 'error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // File transport for combined logs
        new winston.transports.File({
            filename: 'combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Add performance tracking
class PerformanceLogger {
    constructor() {
        this.starts = new Map();
    }
    
    start(label) {
        this.starts.set(label, Date.now());
    }
    
    end(label) {
        const start = this.starts.get(label);
        if (!start) return;
        
        const duration = Date.now() - start;
        logger.debug(`⏱️ ${label}: ${duration}ms`);
        this.starts.delete(label);
        
        return duration;
    }
}

const performanceLogger = new PerformanceLogger();

module.exports = { logger, performanceLogger };
