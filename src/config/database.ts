import { PrismaClient } from "@prisma/client";
import { config } from "./env";
import logger from "@/utils/logger";
import { NextFunction } from "express";

// Prisma Client singleton
class Database {
  private static instance: PrismaClient;
  private static isConnected = false;

  public static getInstance(): PrismaClient {
    if (!Database.instance) {
      Database.instance = new PrismaClient({
        log: config.isDevelopment
          ? ["query", "info", "warn", "error"]
          : ["error"],
        errorFormat: "pretty",
      });

      // Add middleware for logging
      Database.instance.$use(async (params: any, next: NextFunction) => {
        const before = Date.now();
        const result = await next(params);
        const after = Date.now();

        logger.debug(
          `Query ${params.model}.${params.action} took ${after - before}ms`
        );
        return result;
      });

      // Add middleware for soft deletes (if needed)
      Database.instance.$use(async (params: any, next: NextFunction) => {
        // Add soft delete logic here if required
        return next(params);
      });
    }

    return Database.instance;
  }

  public static async connect(): Promise<void> {
    try {
      if (!Database.isConnected) {
        const prisma = Database.getInstance();
        await prisma.$connect();
        Database.isConnected = true;
        logger.info("Successfully connected to database");

        // Test the connection
        await prisma.$queryRaw`SELECT 1`;
        logger.info("Database connection test successful");
      }
    } catch (error) {
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    try {
      if (Database.instance && Database.isConnected) {
        await Database.instance.$disconnect();
        Database.isConnected = false;
        logger.info("Disconnected from database");
      }
    } catch (error) {
      logger.error("Error disconnecting from database:", error);
      throw error;
    }
  }

  public static async healthCheck(): Promise<boolean> {
    try {
      const prisma = Database.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return false;
    }
  }

  public static isConnectedToDB(): boolean {
    return Database.isConnected;
  }
}

// Export the singleton instance
export const prisma = Database.getInstance();

// Export database utilities
export default Database;

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("SIGINT received, closing database connection...");
  await Database.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing database connection...");
  await Database.disconnect();
  process.exit(0);
});
