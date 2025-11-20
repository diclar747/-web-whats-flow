const pino = require('pino');

// Configuración de logger con Pino
const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            singleLine: false
        }
    } : undefined,
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        }
    },
    base: {
        env: process.env.NODE_ENV,
        version: '1.0.0'
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

// Helper para crear child loggers con contexto
const createLogger = (context) => {
    return logger.child({ context });
};

// Wrapper para mantener compatibilidad con console.log existente
const compatibleLogger = {
    debug: (...args) => logger.debug(args.join(' ')),
    info: (...args) => logger.info(args.join(' ')),
    warn: (...args) => logger.warn(args.join(' ')),
    error: (...args) => logger.error(args.join(' ')),
    fatal: (...args) => logger.fatal(args.join(' '))
};

module.exports = {
    logger,
    createLogger,
    compatibleLogger
};
