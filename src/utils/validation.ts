import Joi from "joi";
import { ProjectType, RoomType, InteriorStyle } from "@/types";
import { UserType } from "@prisma/client";

// Base validation schemas
export const schemas = {
  // Common schemas
  id: Joi.string().trim().min(1).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().trim().min(2).max(100).required(),

  // User schemas
  userType: Joi.string()
    .valid(...Object.values(UserType))
    .required(),
  organization: Joi.string().trim().min(2).max(100).optional(),

  // Project schemas
  projectType: Joi.string()
    .valid(...Object.values(ProjectType))
    .required(),
  interiorStyle: Joi.string()
    .valid(...Object.values(InteriorStyle))
    .required(),
  projectName: Joi.string().trim().min(2).max(100).required(),
  projectDescription: Joi.string().trim().max(500).optional(),

  // Room schemas
  roomType: Joi.string()
    .valid(...Object.values(RoomType))
    .required(),
  roomName: Joi.string().trim().min(2).max(100).optional(),
  dimension: Joi.number().positive().max(50).required(), // Max 50 meters
  materials: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .min(1)
    .max(10)
    .required(),
  ambientColor: Joi.string().trim().min(2).max(50).optional(),
  freePrompt: Joi.string().trim().max(1000).optional(),

  // Design schemas
  customPrompt: Joi.string().trim().max(1000).optional(),
  aiProvider: Joi.string().valid("openai", "replicate").optional(),

  // Pagination schemas
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),

  // Search schemas
  search: Joi.string().trim().min(1).max(100).optional(),
  isActive: Joi.boolean().optional(),
};

// Auth validation schemas
export const authSchemas = {
  register: Joi.object({
    email: schemas.email,
    name: schemas.name,
    password: schemas.password,
    userType: schemas.userType,
    organization: schemas.organization,
  }),

  login: Joi.object({
    email: schemas.email,
    password: schemas.password,
  }),

  updateProfile: Joi.object({
    name: schemas.name.optional(),
    organization: schemas.organization,
  }),

  changePassword: Joi.object({
    currentPassword: schemas.password,
    newPassword: schemas.password,
  }),
};

// Project validation schemas
export const projectSchemas = {
  create: Joi.object({
    name: schemas.projectName,
    description: schemas.projectDescription,
    type: schemas.projectType,
    style: schemas.interiorStyle,
  }),

  update: Joi.object({
    name: schemas.projectName.optional(),
    description: schemas.projectDescription,
    type: schemas.projectType.optional(),
    style: schemas.interiorStyle.optional(),
    isActive: schemas.isActive,
  }),

  query: Joi.object({
    page: schemas.page,
    limit: schemas.limit,
    type: schemas.projectType.optional(),
    style: schemas.interiorStyle.optional(),
    isActive: schemas.isActive,
    search: schemas.search,
  }),
};

// Room validation schemas
export const roomSchemas = {
  create: Joi.object({
    projectId: schemas.id,
    name: schemas.roomName,
    type: schemas.roomType,
    length: schemas.dimension,
    width: schemas.dimension,
    height: schemas.dimension,
    materials: schemas.materials,
    ambientColor: schemas.ambientColor,
    freePrompt: schemas.freePrompt,
  }),

  update: Joi.object({
    name: schemas.roomName,
    type: schemas.roomType.optional(),
    length: schemas.dimension.optional(),
    width: schemas.dimension.optional(),
    height: schemas.dimension.optional(),
    materials: schemas.materials.optional(),
    ambientColor: schemas.ambientColor,
    freePrompt: schemas.freePrompt,
  }),

  query: Joi.object({
    page: schemas.page,
    limit: schemas.limit,
    projectId: schemas.id.optional(),
    type: schemas.roomType.optional(),
  }),
};

// Design validation schemas
export const designSchemas = {
  generate: Joi.object({
    roomId: schemas.id,
    customPrompt: schemas.customPrompt,
    aiProvider: schemas.aiProvider,
  }),

  query: Joi.object({
    page: schemas.page,
    limit: schemas.limit,
    roomId: schemas.id.optional(),
    status: Joi.string()
      .valid("PENDING", "PROCESSING", "COMPLETED", "FAILED")
      .optional(),
    aiProvider: schemas.aiProvider.optional(),
  }),
};

// File upload validation
export const uploadSchemas = {
  roomImage: Joi.object({
    roomId: schemas.id.optional(),
  }),
};

// Validation utility functions
export class ValidationUtil {
  /**
   * Validate request body against schema
   */
  static validate<T>(
    data: any,
    schema: Joi.Schema
  ): { value: T; error?: string } {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return { value, error: errorMessage };
    }

    return { value };
  }

  /**
   * Validate and format validation errors
   */
  static validateWithDetails<T>(
    data: any,
    schema: Joi.Schema
  ): {
    value: T;
    errors?: Array<{ field: string; message: string }>;
  } {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));
      return { value, errors };
    }

    return { value };
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate CUID format (used by Prisma)
   */
  static isValidCUID(cuid: string): boolean {
    const cuidRegex = /^c[a-z0-9]{24}$/;
    return cuidRegex.test(cuid);
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, "") // Remove basic HTML tags
      .replace(/javascript:/gi, "") // Remove javascript: protocols
      .replace(/on\w+=/gi, ""); // Remove event handlers
  }

  /**
   * Validate file type
   */
  static isValidFileType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Validate file size
   */
  static isValidFileSize(size: number, maxSize: number): boolean {
    return size <= maxSize;
  }

  /**
   * Generate validation error response
   */
  static createValidationError(
    errors: Array<{ field: string; message: string }>
  ) {
    return {
      success: false,
      message: "Validation failed",
      errors,
    };
  }
}
