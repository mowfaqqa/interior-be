import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3001),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Authentication
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default("7d"),
  BCRYPT_ROUNDS: Joi.number().default(12),

  // AI Services
  OPENAI_API_KEY: Joi.string().required(),
  REPLICATE_API_TOKEN: Joi.string().required(),

  // File Upload
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: Joi.string().default("image/jpeg,image/png,image/webp"),

  // Server
  API_VERSION: Joi.string().default("v1"),
  CORS_ORIGIN: Joi.string().default("http://localhost:3000"),

  // Redis
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  REDIS_PASSWORD: Joi.string().allow("").default(""),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  AI_RATE_LIMIT_MAX_REQUESTS: Joi.number().default(10),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug")
    .default("info"),
  LOG_FILE: Joi.string().default("logs/app.log"),

  // Health Check
  HEALTH_CHECK_PATH: Joi.string().default("/health"),

  // Swagger
  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default("/api-docs"),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,

  database: {
    url: envVars.DATABASE_URL,
  },

  auth: {
    jwtSecret: envVars.JWT_SECRET,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN,
    bcryptRounds: envVars.BCRYPT_ROUNDS,
  },

  ai: {
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
    },
    replicate: {
      apiToken: envVars.REPLICATE_API_TOKEN,
    },
  },

  upload: {
    cloudinary: {
      cloudName: envVars.CLOUDINARY_CLOUD_NAME,
      apiKey: envVars.CLOUDINARY_API_KEY,
      apiSecret: envVars.CLOUDINARY_API_SECRET,
    },
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedFileTypes: envVars.ALLOWED_FILE_TYPES.split(","),
  },

  server: {
    apiVersion: envVars.API_VERSION,
    corsOrigin: envVars.CORS_ORIGIN,
  },

  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    aiMaxRequests: envVars.AI_RATE_LIMIT_MAX_REQUESTS,
  },

  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE,
  },

  healthCheck: {
    path: envVars.HEALTH_CHECK_PATH,
  },

  swagger: {
    enabled: envVars.SWAGGER_ENABLED,
    path: envVars.SWAGGER_PATH,
  },

  isDevelopment: envVars.NODE_ENV === "development",
  isProduction: envVars.NODE_ENV === "production",
  isTest: envVars.NODE_ENV === "test",
};
