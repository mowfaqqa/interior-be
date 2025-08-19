import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { JwtPayload } from "../types";
import logger from "./logger";

export class JwtUtil {
  /**
   * Generate JWT token
   */
  static generateToken(payload: JwtPayload): string {
    try {
      return jwt.sign(payload, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiresIn,
        issuer: "interior-design-api",
        audience: "interior-design-app",
      });
    } catch (error) {
      logger.error("Error generating JWT token:", error);
      throw new Error("Failed to generate token");
    }
  }

  /**
   * Generate refresh token (longer expiry)
   */
  static generateRefreshToken(payload: JwtPayload): string {
    try {
      return jwt.sign(payload, config.auth.jwtSecret, {
        expiresIn: "30d", // 30 days for refresh token
        issuer: "interior-design-api",
        audience: "interior-design-app",
      });
    } catch (error) {
      logger.error("Error generating refresh token:", error);
      throw new Error("Failed to generate refresh token");
    }
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret, {
        issuer: "interior-design-api",
        audience: "interior-design-app",
      }) as JwtPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Token has expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid token");
      } else {
        logger.error("Error verifying JWT token:", error);
        throw new Error("Token verification failed");
      }
    }
  }

  /**
   * Decode token without verification (for extracting payload)
   */
  static decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      return decoded;
    } catch (error) {
      logger.error("Error decoding JWT token:", error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded: any = this.decodeToken(token);
      if (!decoded || !decoded?.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration date
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded: any = this.decodeToken(token);
      if (!decoded || !decoded?.exp) return null;

      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Generate a secure random string for token secrets
   */
  static generateSecret(length: number = 64): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }
}
