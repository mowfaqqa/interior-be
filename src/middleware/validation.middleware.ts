import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse, ValidationError } from '../types';
import { ValidationUtil } from '../utils/validation';
import logger from '../utils/logger';

/**
 * Generic validation middleware factory
 */
export const validate = (schema: Joi.Schema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      const { value, errors } = ValidationUtil.validateWithDetails(dataToValidate, schema);

      if (errors && errors.length > 0) {
        logger.warn('Validation failed', {
          target,
          errors,
          data: dataToValidate,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'Invalid input data',
          errors,
        });
        return;
      }

      // Replace the original data with validated and sanitized data
      req[target] = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during validation',
        error: 'Validation error',
      });
    }
  };
};

/**
 * Validate request body
 */
export const validateBody = (schema: Joi.Schema) => validate(schema, 'body');

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Joi.Schema) => validate(schema, 'query');

/**
 * Validate route parameters
 */
export const validateParams = (schema: Joi.Schema) => validate(schema, 'params');

/**
 * Validate file upload
 */
export const validateFile = (options: {
  required?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  fieldName?: string;
} = {}) => {
  const {
    required = false,
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    fieldName = 'file',
  } = options;

  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const file = req.file;

      // Check if file is required
      if (required && !file) {
        res.status(400).json({
          success: false,
          message: 'File is required',
          error: 'Missing file',
          errors: [{ field: fieldName, message: 'File is required' }],
        });
        return;
      }

      // If file is not required and not provided, continue
      if (!required && !file) {
        next();
        return;
      }

      if (file) {
        const errors: ValidationError[] = [];

        // Validate file size
        if (!ValidationUtil.isValidFileSize(file.size, maxSize)) {
          errors.push({
            field: fieldName,
            message: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
          });
        }

        // Validate file type
        if (!ValidationUtil.isValidFileType(file.mimetype, allowedTypes)) {
          errors.push({
            field: fieldName,
            message: `File type must be one of: ${allowedTypes.join(', ')}`,
          });
        }

        // Validate file name
        if (file.originalname.length > 255) {
          errors.push({
            field: fieldName,
            message: 'File name is too long (max 255 characters)',
          });
        }

        if (errors.length > 0) {
          logger.warn('File validation failed', {
            errors,
            fileInfo: {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            },
            ip: req.ip,
          });

          res.status(400).json({
            success: false,
            message: 'File validation failed',
            error: 'Invalid file',
            errors,
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('File validation middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during file validation',
        error: 'File validation error',
      });
    }
  };
};

/**
 * Sanitize request data to prevent XSS and injection attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Recursively sanitize object properties
    const sanitizeObject = (obj: any): any => {
      // Base case: if it's a string, sanitize it and return
      if (typeof obj === 'string') {
        return ValidationUtil.sanitizeString(obj);
      }
      
      // Recursive case: if it's an array, sanitize each element
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      // Recursive case: if it's an object, sanitize its properties
      if (obj && typeof obj === 'object') {
        // Create a new object or modify in-place
        // For req.body and req.params, it's safer to reassign
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      // Return the value as is if it's not a string, array, or object
      return obj;
    };

    // Sanitize body and params (reassigning is okay for these)
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    // Sanitize query parameters (MUST BE MODIFIED IN-PLACE)
    if (req.query) {
      for (const key in req.query) {
        if (Object.prototype.hasOwnProperty.call(req.query, key)) {
          (req.query as any)[key] = sanitizeObject(req.query[key]);
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during input sanitization',
      error: 'Sanitization error',
    });
  }
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    const errors: ValidationError[] = [];

    if (isNaN(pageNum) || pageNum < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push({
        field: 'limit',
        message: 'Limit must be a positive integer between 1 and 100',
      });
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters',
        error: 'Pagination validation failed',
        errors,
      });
      return;
    }

    // Set validated pagination values
    req.query.page = pageNum.toString();
    req.query.limit = limitNum.toString();

    next();
  } catch (error) {
    logger.error('Pagination validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during pagination validation',
      error: 'Pagination validation error',
    });
  }
};

/**
 * Validate resource ID parameters
 */
export const validateResourceId = (paramName: string = 'id') => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const id = req.params[paramName];

      if (!id) {
        res.status(400).json({
          success: false,
          message: `${paramName} is required`,
          error: 'Missing resource ID',
          errors: [{ field: paramName, message: `${paramName} is required` }],
        });
        return;
      }

      // Validate CUID format (used by Prisma)
      if (!ValidationUtil.isValidCUID(id)) {
        res.status(400).json({
          success: false,
          message: `Invalid ${paramName} format`,
          error: 'Invalid resource ID format',
          errors: [{ field: paramName, message: `${paramName} must be a valid ID` }],
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Resource ID validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during ID validation',
        error: 'ID validation error',
      });
    }
  };
};

/**
 * Rate limiting validation (check if user has exceeded limits)
 */
export const validateRateLimit = (options: {
  maxRequests: number;
  windowMs: number;
  message?: string;
} = { maxRequests: 100, windowMs: 15 * 60 * 1000 }) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const identifier = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Clean up old entries
      const userRequests = requests.get(identifier);
      if (!userRequests || userRequests.resetTime <= windowStart) {
        requests.set(identifier, { count: 1, resetTime: now + options.windowMs });
        next();
        return;
      }

      // Check if limit exceeded
      if (userRequests.count >= options.maxRequests) {
        const resetTimeSeconds = Math.ceil((userRequests.resetTime - now) / 1000);
        
        res.status(429).json({
          success: false,
          message: options.message || 'Too many requests. Please try again later.',
          error: 'Rate limit exceeded',
        });

        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTimeSeconds.toString(),
        });

        return;
      }

      // Increment counter
      userRequests.count++;
      const remaining = options.maxRequests - userRequests.count;

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil((userRequests.resetTime - now) / 1000).toString(),
      });

      next();
    } catch (error) {
      logger.error('Rate limit validation error:', error);
      next(); // Continue on error to avoid blocking legitimate requests
    }
  };
};