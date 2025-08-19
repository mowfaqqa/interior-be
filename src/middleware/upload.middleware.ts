import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { ApiResponse } from "../types";
import logger from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import path from "path";

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  try {
    // Check file type
    if (!config.upload.allowedFileTypes.includes(file.mimetype)) {
      logger.warn("File upload rejected - invalid type", {
        filename: file.originalname,
        mimetype: file.mimetype,
        allowedTypes: config.upload.allowedFileTypes,
        ip: req.ip,
      });

      cb(
        new Error(
          `Invalid file type. Allowed types: ${config.upload.allowedFileTypes.join(
            ", "
          )}`
        )
      );
      return;
    }

    // Additional security checks
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    if (!allowedExtensions.includes(ext)) {
      logger.warn("File upload rejected - invalid extension", {
        filename: file.originalname,
        extension: ext,
        ip: req.ip,
      });

      cb(
        new Error(
          `Invalid file extension. Allowed extensions: ${allowedExtensions.join(
            ", "
          )}`
        )
      );
      return;
    }

    // Check for potential security risks in filename
    if (
      file.originalname.includes("..") ||
      file.originalname.includes("/") ||
      file.originalname.includes("\\") ||
      file.originalname.startsWith(".")
    ) {
      logger.warn("File upload rejected - suspicious filename", {
        filename: file.originalname,
        ip: req.ip,
      });

      cb(
        new Error(
          "Invalid filename. Please use a safe filename without special characters."
        )
      );
      return;
    }

    cb(null, true);
  } catch (error) {
    logger.error("File filter error:", error);
    cb(new Error("File validation failed"));
  }
};

// Create multer instance with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 5, // Maximum 5 files per request
    fields: 10, // Maximum 10 non-file fields
    fieldNameSize: 100, // Maximum field name size
    fieldSize: 1024 * 1024, // Maximum field value size (1MB)
  },
});

/**
 * Middleware for single file upload
 */
export const uploadSingle = (fieldName: string = "file") => {
  return [upload.single(fieldName), handleUploadError];
};

/**
 * Middleware for multiple file upload
 */
export const uploadMultiple = (
  fieldName: string = "files",
  maxCount: number = 5
) => {
  return [upload.array(fieldName, maxCount), handleUploadError];
};

/**
 * Middleware for multiple fields with files
 */
export const uploadFields = (fields: { name: string; maxCount: number }[]) => {
  return [upload.fields(fields), handleUploadError];
};

/**
 * Error handling middleware for multer
 */
export const handleUploadError = (
  err: any,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    logger.warn("Multer upload error", {
      error: err.message,
      code: err.code,
      field: err.field,
      ip: req.ip,
    });

    let message = "File upload error";
    let statusCode = 400;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = `File too large. Maximum size is ${Math.round(
          config.upload.maxFileSize / 1024 / 1024
        )}MB`;
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files. Maximum 5 files allowed";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields in the request";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = `Unexpected file field: ${err.field}`;
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts in the multipart request";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      default:
        message = err.message || "File upload error";
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: err.code,
    });
    return;
  }

  if (err) {
    logger.error("Upload middleware error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
      error: "Upload error",
    });
    return;
  }

  next();
};

/**
 * Middleware to validate uploaded file properties
 */
export const validateUploadedFile = (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  try {
    const file = req.file;

    if (!file) {
      next();
      return;
    }

    // Additional validation after multer processing
    const errors: string[] = [];

    // Check if file buffer exists
    if (!file.buffer || file.buffer.length === 0) {
      errors.push("File is empty or corrupted");
    }

    // Validate image dimensions (basic check)
    if (file.mimetype.startsWith("image/")) {
      // You might want to use a library like 'sharp' for more detailed image validation
      if (file.size < 100) {
        // Very small files are likely corrupted
        errors.push("Image file appears to be corrupted");
      }
    }

    // Check for file type spoofing (basic check)
    const expectedMimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const expectedMimeType =
      expectedMimeTypes[fileExtension as keyof typeof expectedMimeTypes];

    if (expectedMimeType && file.mimetype !== expectedMimeType) {
      errors.push("File extension does not match file content");
    }

    if (errors.length > 0) {
      logger.warn("File validation failed after upload", {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        errors,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: "File validation failed",
        error: errors.join(", "),
      });
      return;
    }

    // Add additional metadata to file object
    (file as any).uploadId = uuidv4();
    (file as any).uploadedAt = new Date().toISOString();

    logger.info("File uploaded and validated successfully", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadId: (file as any).uploadId,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.error("File validation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during file validation",
      error: "File validation error",
    });
  }
};

/**
 * Middleware to clean up temporary files on error
 */
export const cleanupTempFiles = (
  err: any,
  req: any,
  res: Response,
  next: NextFunction
): void => {
  // Clean up any temporary file data from memory
  if (req.file) {
    delete req?.file.buffer;
  }

  if (req.files) {
    if (Array.isArray(req?.files)) {
      req?.files.forEach((file: any) => delete file?.buffer);
    } else {
      Object.values(req?.files).forEach((files) => {
        if (Array.isArray(files)) {
          files.forEach((file: any) => delete file.buffer);
        }
      });
    }
  }

  logger.debug("Temporary file data cleaned up");
  next(err);
};

/**
 * Create a filename-safe string
 */
export const createSafeFilename = (originalname: string): string => {
  const ext = path.extname(originalname);
  const name = path.basename(originalname, ext);

  // Remove or replace unsafe characters
  const safeName = name
    .replace(/[^a-zA-Z0-9\-_]/g, "_") // Replace unsafe chars with underscore
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .substring(0, 50); // Limit length

  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);

  return `${safeName}_${timestamp}_${randomString}${ext}`;
};

/**
 * Middleware to generate safe filenames
 */
export const generateSafeFilename = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.file) {
      (req.file as any).safeFilename = createSafeFilename(
        req.file.originalname
      );
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          (file as any).safeFilename = createSafeFilename(file.originalname);
        });
      } else {
        Object.values(req.files).forEach((files) => {
          if (Array.isArray(files)) {
            files.forEach((file) => {
              (file as any).safeFilename = createSafeFilename(
                file.originalname
              );
            });
          }
        });
      }
    }

    next();
  } catch (error) {
    logger.error("Filename generation error:", error);
    next(error);
  }
};
