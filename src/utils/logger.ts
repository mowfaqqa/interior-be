import winston from "winston";
import { config } from "@/config/env";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }: any) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logging.level,
  }),
];

// Add file transport only in production or if explicitly enabled
if (config.isProduction || process.env.ENABLE_FILE_LOGGING === "true") {
  transports.push(
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.file,
      format: fileFormat,
      level: config.logging.level,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      format: fileFormat,
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports,
  exitOnError: false,
});

// Add custom methods for structured logging
interface CustomLogger extends winston.Logger {
  request: (message: string, meta?: any) => void;
  response: (message: string, meta?: any) => void;
  database: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  ai: (message: string, meta?: any) => void;
}

// Extend logger with custom methods
const customLogger = logger as CustomLogger;

customLogger.request = (message: string, meta?: any) => {
  logger.info(`[REQUEST] ${message}`, meta);
};

customLogger.response = (message: string, meta?: any) => {
  logger.info(`[RESPONSE] ${message}`, meta);
};

customLogger.database = (message: string, meta?: any) => {
  logger.debug(`[DATABASE] ${message}`, meta);
};

customLogger.security = (message: string, meta?: any) => {
  logger.warn(`[SECURITY] ${message}`, meta);
};

customLogger.ai = (message: string, meta?: any) => {
  logger.info(`[AI] ${message}`, meta);
};

// Handle uncaught exceptions and unhandled rejections
if (config.isProduction) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
      format: fileFormat,
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
      format: fileFormat,
    })
  );
}

export default customLogger;
