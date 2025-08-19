import { Response, NextFunction } from "express";
import { JwtUtil } from "../utils/jwt";
import { prisma } from "../config/database";
import logger from "../utils/logger";

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: any,
  res: any,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.header("Authorization");
    const token = JwtUtil.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
        error: "No authorization token found",
      });
      return;
    }

    // Verify token
    const decoded = JwtUtil.verifyToken(token);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded?.userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        userType: true,
        organization: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
        error: "User does not exist",
      });
      return;
    }

    // Check if user is verified (optional, based on your requirements)
    if (!user.isVerified && process.env.REQUIRE_EMAIL_VERIFICATION === "true") {
      res.status(401).json({
        success: false,
        message: "Account not verified. Please verify your email.",
        error: "Email verification required",
      });
      return;
    }

    // Attach user to request
    req.user = user;

    // Log successful authentication
    logger.security("User authenticated successfully", {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    next();
  } catch (error) {
    logger.security("Authentication failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    if (error instanceof Error) {
      if (error.message === "Token has expired") {
        res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
          error: "TOKEN_EXPIRED",
        });
        return;
      }

      if (error.message === "Invalid token") {
        res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
          error: "INVALID_TOKEN",
        });
        return;
      }
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed.",
      error: "Authentication error",
    });
  }
};

/**
 * Middleware to check if user is verified
 */
export const requireVerification = async (
  req: any,
  res: any,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "No user found in request",
    });
    return;
  }

  if (!req.user.isVerified) {
    res.status(403).json({
      success: false,
      message: "Email verification required.",
      error: "Account not verified",
    });
    return;
  }

  next();
};

/**
 * Middleware to check user type
 */
export const requireUserType = (allowedTypes: string[]) => {
  return async (req: any, res: any, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "No user found in request",
      });
      return;
    }

    if (!allowedTypes.includes(req.user.userType)) {
      logger.security("Access denied - insufficient permissions", {
        userId: req.user.id,
        userType: req.user.userType,
        requiredTypes: allowedTypes,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
        error: "Insufficient permissions",
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check resource ownership
 */
export const requireOwnership = (resourceField: string = "userId") => {
  return async (req: any, res: any, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "No user found in request",
      });
      return;
    }

    const resourceUserId = req.body[resourceField] || req.params[resourceField];

    if (resourceUserId && resourceUserId !== req.user.id) {
      logger.security("Access denied - resource ownership violation", {
        userId: req.user.id,
        resourceUserId,
        resourceField,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
        error: "Resource ownership violation",
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: any,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.header("Authorization");
    const token = JwtUtil.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = JwtUtil.verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          userType: true,
          organization: true,
          isVerified: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
    logger.debug("Optional authentication failed:", error);
  }

  next();
};

/**
 * Middleware to validate session token against database
 */
export const validateSession = async (
  req: any,
  res: any,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
        error: "No user found in request",
      });
      return;
    }

    const authHeader = req.header("Authorization");
    const token = JwtUtil.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided.",
        error: "Missing token",
      });
      return;
    }

    // Check if session exists in database
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      res.status(401).json({
        success: false,
        message: "Invalid session.",
        error: "Session not found",
      });
      return;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await prisma.session.delete({
        where: { token },
      });

      res.status(401).json({
        success: false,
        message: "Session expired.",
        error: "SESSION_EXPIRED",
      });
      return;
    }

    next();
  } catch (error) {
    logger.error("Session validation error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during session validation.",
      error: "Session validation failed",
    });
  }
};
