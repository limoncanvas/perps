import winston from 'winston';

// Helper to serialize error objects properly
function serializeError(error: any): any {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).response && { response: (error as any).response },
      ...(error as any).status && { status: (error as any).status },
    };
  }
  return error;
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format((info) => {
    // Serialize error objects in metadata before JSON formatting
    if (info.error) {
      info.error = serializeError(info.error);
    }
    return info;
  })(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, error, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Handle error object specially
    if (error) {
      const errorInfo = serializeError(error);
      msg += ` Error: ${errorInfo.message || JSON.stringify(errorInfo)}`;
      if (errorInfo.stack && process.env.LOG_LEVEL === 'debug') {
        msg += `\n${errorInfo.stack}`;
      }
    }
    
    // Handle other metadata
    const otherMeta = { ...meta };
    if (Object.keys(otherMeta).length > 0) {
      msg += ` ${JSON.stringify(otherMeta)}`;
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

export default logger;
