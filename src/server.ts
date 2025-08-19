import app from "./app";
import { config } from "./config/env";
import Database from "./config/database";
import logger from "./utils/logger";

// Connect to database
async function connectDatabase() {
  try {
    await Database.connect();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Connect to database first
    await connectDatabase();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(
        `📚 API Documentation: http://localhost:${config.port}${config.swagger.path}`
      );
      logger.info(
        `🏥 Health Check: http://localhost:${config.port}${config.healthCheck.path}`
      );

      if (config.isDevelopment) {
        logger.info(`🔧 Development mode enabled`);
        logger.info(
          `📋 API Base URL: http://localhost:${config.port}/api/${config.server.apiVersion}`
        );
      }
    });

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      const bind =
        typeof config.port === "string"
          ? "Pipe " + config.port
          : "Port " + config.port;

      switch (error.code) {
        case "EACCES":
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      server.close(async () => {
        logger.info("HTTP server closed");

        try {
          await Database.disconnect();
          logger.info("Database disconnected");
          logger.info("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          logger.error("Error during graceful shutdown:", error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 10000);
    };

    // Listen for shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  startServer();
}

export default startServer;
