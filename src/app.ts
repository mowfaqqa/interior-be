import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";

import { config } from "./config/env";
import { specs } from "./config/swagger";
import Database from "./config/database";
import logger from "./utils/logger";

// Middleware
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { sanitizeInput } from "./middleware/validation.middleware";

// Routes
import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import roomRoutes from "./routes/room.routes";
import designRoutes from "./routes/design.routes";
import uploadRoutes from "./routes/upload.routes";

// Create Express application
const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: config.isProduction ? undefined : false, // Disable CSP in development for Swagger
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.isDevelopment
      ? [
          config.server.corsOrigin,
          "http://localhost:3000",
          "http://localhost:3001",
        ]
      : config.server.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Compression middleware
app.use(compression());

// Logging middleware
if (config.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: {
        write: (message: string) => {
          logger.info(message.trim());
        },
      },
    })
  );
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    error: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.url,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      error: "RATE_LIMIT_EXCEEDED",
    });
  },
});

app.use(limiter);

// Stricter rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.aiMaxRequests,
  message: {
    success: false,
    message: "Too many AI generation requests. Please try again later.",
    error: "AI_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res: any, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "Invalid JSON in request body",
          error: "INVALID_JSON",
        });
        throw e;
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint
app.get(config.healthCheck.path, async (req, res) => {
  try {
    const dbHealthy = await Database.healthCheck();

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: config.env,
      version: process.env.npm_package_version || "1.0.0",
      database: dbHealthy ? "connected" : "disconnected",
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100,
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
    });
  }
});

// API routes
const apiRouter = express.Router();

// Apply AI rate limiting to design generation routes
apiRouter.use("/designs/generate", aiLimiter);

// Mount route modules
apiRouter.use("/auth", authRoutes);
apiRouter.use("/projects", projectRoutes);
apiRouter.use("/rooms", roomRoutes);
apiRouter.use("/designs", designRoutes);
apiRouter.use("/uploads", uploadRoutes);

// Mount API router
app.use(`/api/${config.server.apiVersion}`, apiRouter);

// Swagger documentation
if (config.swagger.enabled) {
  app.use(
    config.swagger.path,
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Interior Design AI API Documentation",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      },
    })
  );

  // Redirect root to API documentation in development
  if (config.isDevelopment) {
    app.get("/", (req, res) => {
      res.redirect(config.swagger.path);
    });
  }
}

// Production root endpoint
if (config.isProduction) {
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Interior Design AI API",
      version: process.env.npm_package_version || "1.0.0",
      environment: config.env,
      documentation: config.swagger.enabled
        ? `${req.protocol}://${req.get("host")}${config.swagger.path}`
        : "Not available",
    });
  });
}

// Handle 404 routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, starting graceful shutdown...");

  try {
    await Database.disconnect();
    logger.info("Database disconnected successfully");
  } catch (error) {
    logger.error("Error during database disconnect:", error);
  }

  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, starting graceful shutdown...");

  try {
    await Database.disconnect();
    logger.info("Database disconnected successfully");
  } catch (error) {
    logger.error("Error during database disconnect:", error);
  }

  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception! Shutting down...", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Promise Rejection! Shutting down...", reason);
  process.exit(1);
});

export default app;
