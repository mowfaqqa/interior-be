import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ApiResponse } from "@/types";
import { config } from "@/config/env";
import logger from "@/utils/logger";

/**
 * Custom error class
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create operational error
 */
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string
): AppError => {
  return new AppError(message, statusCode, code);
};

/**
 * Async error handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Prisma errors
 */
const handlePrismaError = (
  error: Prisma.PrismaClientKnownRequestError
): AppError => {
  switch (error.code) {
    case "P2002": {
      // Unique constraint violation
      const field = error.meta?.target as string[] | undefined;
      const fieldName = field ? field[0] : "field";
      return new AppError(
        `${fieldName} already exists`,
        409,
        "DUPLICATE_ENTRY"
      );
    }

    case "P2014": {
      // Required relation violation
      return new AppError(
        "The change you are trying to make would violate the required relation",
        400,
        "RELATION_VIOLATION"
      );
    }

    case "P2003": {
      // Foreign key constraint violation
      const field = error.meta?.field_name as string | undefined;
      return new AppError(
        `Invalid reference: ${field || "foreign key constraint failed"}`,
        400,
        "FOREIGN_KEY_VIOLATION"
      );
    }

    case "P2025": {
      // Record not found
      return new AppError("Record not found", 404, "NOT_FOUND");
    }

    case "P2016": {
      // Query interpretation error
      return new AppError("Query interpretation error", 400, "QUERY_ERROR");
    }

    case "P2021": {
      // Table not found
      return new AppError("Table does not exist", 500, "TABLE_NOT_FOUND");
    }

    case "P2022": {
      // Column not found
      return new AppError("Column does not exist", 500, "COLUMN_NOT_FOUND");
    }

    default: {
      logger.error("Unhandled Prisma error:", error);
      return new AppError("Database operation failed", 500, "DATABASE_ERROR");
    }
  }
};

/**
 * Handle validation errors
 */
const handleValidationError = (error: any): AppError => {
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors || {}).map(
      (err: any) => err.message
    );
    return new AppError(
      `Validation Error: ${errors.join(", ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  return new AppError("Validation failed", 400, "VALIDATION_ERROR");
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error: any): AppError => {
  if (error.name === "JsonWebTokenError") {
    return new AppError("Invalid token", 401, "INVALID_TOKEN");
  }

  if (error.name === "TokenExpiredError") {
    return new AppError("Token expired", 401, "TOKEN_EXPIRED");
  }

  return new AppError("Authentication failed", 401, "AUTH_ERROR");
};

/**
 * Handle cast errors
 */
const handleCastError = (error: any): AppError => {
  return new AppError("Invalid data format", 400, "CAST_ERROR");
};

/**
 * Send error response for development
 */
const sendErrorDev = (error: AppError, res: Response<ApiResponse>): void => {
  const response: ApiResponse = {
    success: false,
    message: error.message,
    error: error.code || "INTERNAL_ERROR",
  };

  // Include stack trace in development
  if (config.isDevelopment) {
    (response as any).stack = error.stack;
    (response as any).details = {
      name: error.name,
      isOperational: error.isOperational,
    };
  }

  res.status(error.statusCode).json(response);
};

/**
 * Send error response for production
 */
const sendErrorProd = (error: AppError, res: Response<ApiResponse>): void => {
  // Operational, trusted error: send message to client
  if (error.isOperational) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: error.code || "OPERATIONAL_ERROR",
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error("Non-operational error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: "INTERNAL_ERROR",
    });
  }
};

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: any,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  let err = { ...error };
  err.message = error.message;

  // Log error details
  logger.error("Error caught by global handler:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: (req as any).user?.id,
  });

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    err = handlePrismaError(error);
  }

  // Prisma validation errors
  else if (error instanceof Prisma.PrismaClientValidationError) {
    err = new AppError(
      "Invalid query parameters",
      400,
      "QUERY_VALIDATION_ERROR"
    );
  }

  // Validation errors
  else if (error.name === "ValidationError") {
    err = handleValidationError(error);
  }

  // JWT errors
  else if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    err = handleJWTError(error);
  }

  // Cast errors
  else if (error.name === "CastError") {
    err = handleCastError(error);
  }

  // Syntax errors (usually JSON parsing)
  else if (error instanceof SyntaxError && error.message.includes("JSON")) {
    err = new AppError("Invalid JSON in request body", 400, "INVALID_JSON");
  }

  // 404 errors
  else if (error.statusCode === 404) {
    err = new AppError("Route not found", 404, "NOT_FOUND");
  }

  // Default to AppError if not already
  else if (!(err instanceof AppError)) {
    err = new AppError(
      config.isDevelopment ? error.message : "Something went wrong",
      error.statusCode || 500,
      "INTERNAL_ERROR"
    );
  }

  // Send appropriate error response
  if (config.isDevelopment) {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
};

/**
 * Handle 404 routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    "ROUTE_NOT_FOUND"
  );
  next(error);
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (): void => {
  process.on("uncaughtException", (error: Error) => {
    logger.error("Uncaught Exception! Shutting down...", error);
    process.exit(1);
  });
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (): void => {
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error("Unhandled Promise Rejection:", reason);

    // Close server gracefully
    process.exit(1);
  });
};

/**
 * Graceful shutdown handler
 */
export const handleGracefulShutdown = (server: any): void => {
  const shutdown = (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(() => {
      logger.info("Server closed. Process terminating...");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
