import { PrismaClient, User } from "@prisma/client";
import {
  RegisterDto,
  LoginDto,
  UserProfile,
  LoginResponse,
  JwtPayload,
} from "../types";
import { BcryptUtil } from "../utils/bcrypt";
import { JwtUtil } from "../utils/jwt";
import { AppError } from "../middleware/error.middleware";
import { config } from "../config/env";
import logger from "../utils/logger";

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new user
   */
  async register(userData: RegisterDto): Promise<LoginResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new AppError(
          "User with this email already exists",
          409,
          "USER_EXISTS"
        );
      }

      // Validate password strength
      const passwordValidation = BcryptUtil.validatePasswordStrength(
        userData.password
      );
      if (!passwordValidation.isValid) {
        throw new AppError(
          `Password validation failed: ${passwordValidation.errors.join(", ")}`,
          400,
          "WEAK_PASSWORD"
        );
      }

      // Hash password
      const hashedPassword = await BcryptUtil.hashPassword(userData.password);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          userType: userData.userType,
          organization: userData.organization,
          isVerified: config.isDevelopment, // Auto-verify in development
        },
        select: {
          id: true,
          email: true,
          name: true,
          userType: true,
          organization: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Generate tokens
      const jwtPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
      };

      const token = JwtUtil.generateToken(jwtPayload);
      const refreshToken = JwtUtil.generateRefreshToken(jwtPayload);

      // Create session
      await this.createSession(user.id, token);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      logger.info("User registered successfully", {
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });

      return {
        user: this.formatUserProfile(user),
        token,
        refreshToken,
        expiresIn: config.auth.jwtExpiresIn,
      };
    } catch (error) {
      logger.error("Registration failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Registration failed", 500, "REGISTRATION_ERROR");
    }
  }

  /**
   * Login user
   */
  async login(loginData: LoginDto): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email: loginData.email },
      });

      // Use safe comparison to prevent timing attacks
      const isPasswordValid = await BcryptUtil.safeComparePassword(
        loginData.password,
        user?.password || null
      );

      if (!user || !isPasswordValid) {
        // Log failed login attempt
        logger.security("Failed login attempt", {
          email: loginData.email,
          reason: !user ? "user_not_found" : "invalid_password",
        });

        throw new AppError(
          "Invalid email or password",
          401,
          "INVALID_CREDENTIALS"
        );
      }

      // Check if password needs rehashing
      if (BcryptUtil.needsRehash(user.password)) {
        const newHashedPassword = await BcryptUtil.hashPassword(
          loginData.password
        );
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: newHashedPassword },
        });

        logger.info("Password rehashed for user", { userId: user.id });
      }

      // Generate tokens
      const jwtPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
      };

      const token = JwtUtil.generateToken(jwtPayload);
      const refreshToken = JwtUtil.generateRefreshToken(jwtPayload);

      // Create session
      await this.createSession(user.id, token);

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
      });

      return {
        user: this.formatUserProfile(user),
        token,
        refreshToken,
        expiresIn: config.auth.jwtExpiresIn,
      };
    } catch (error) {
      logger.error("Login failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Login failed", 500, "LOGIN_ERROR");
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<{ token: string; expiresIn: string }> {
    try {
      // Verify refresh token
      const decoded = JwtUtil.verifyToken(refreshToken);

      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, userType: true, isVerified: true },
      });

      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }

      // Generate new access token
      const jwtPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
      };

      const newToken = JwtUtil.generateToken(jwtPayload);

      // Create new session
      await this.createSession(user.id, newToken);

      logger.info("Token refreshed successfully", { userId: user.id });

      return {
        token: newToken,
        expiresIn: config.auth.jwtExpiresIn,
      };
    } catch (error) {
      logger.error("Token refresh failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Token refresh failed", 401, "TOKEN_REFRESH_ERROR");
    }
  }

  /**
   * Logout user
   */
  async logout(token: string): Promise<void> {
    try {
      // Delete session
      await this.prisma.session.deleteMany({
        where: { token },
      });

      logger.info("User logged out successfully");
    } catch (error) {
      logger.error("Logout failed:", error);
      throw new AppError("Logout failed", 500, "LOGOUT_ERROR");
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      // Delete all sessions for user
      await this.prisma.session.deleteMany({
        where: { userId },
      });

      logger.info("User logged out from all devices", { userId });
    } catch (error) {
      logger.error("Logout all devices failed:", error);
      throw new AppError(
        "Logout from all devices failed",
        500,
        "LOGOUT_ALL_ERROR"
      );
    }
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user with password
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });

      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }

      // Verify current password
      const isCurrentPasswordValid = await BcryptUtil.comparePassword(
        currentPassword,
        user.password
      );

      if (!isCurrentPasswordValid) {
        throw new AppError(
          "Current password is incorrect",
          400,
          "INVALID_CURRENT_PASSWORD"
        );
      }

      // Validate new password strength
      const passwordValidation =
        BcryptUtil.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(
          `Password validation failed: ${passwordValidation.errors.join(", ")}`,
          400,
          "WEAK_PASSWORD"
        );
      }

      // Check if new password is different from current
      const isSamePassword = await BcryptUtil.comparePassword(
        newPassword,
        user.password
      );
      if (isSamePassword) {
        throw new AppError(
          "New password must be different from current password",
          400,
          "SAME_PASSWORD"
        );
      }

      // Hash new password
      const hashedNewPassword = await BcryptUtil.hashPassword(newPassword);

      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      // Logout from all devices for security
      await this.logoutAllDevices(userId);

      logger.info("Password changed successfully", { userId });
    } catch (error) {
      logger.error("Password change failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Password change failed",
        500,
        "PASSWORD_CHANGE_ERROR"
      );
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          userType: true,
          organization: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }

      return this.formatUserProfile(user);
    } catch (error) {
      logger.error("Get profile failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Failed to get user profile",
        500,
        "GET_PROFILE_ERROR"
      );
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: { name?: string; organization?: string }
  ): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          userType: true,
          organization: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info("Profile updated successfully", { userId });

      return this.formatUserProfile(user);
    } catch (error) {
      logger.error("Profile update failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Profile update failed", 500, "PROFILE_UPDATE_ERROR");
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
      });

      logger.info("Email verified successfully", { userId });
    } catch (error) {
      logger.error("Email verification failed:", error);
      throw new AppError(
        "Email verification failed",
        500,
        "EMAIL_VERIFICATION_ERROR"
      );
    }
  }

  /**
   * Create session
   */
  private async createSession(userId: string, token: string): Promise<void> {
    try {
      // Calculate expiration time
      const expiresAt = new Date();
      const expirationDays =
        parseInt(config.auth.jwtExpiresIn.replace("d", "")) || 7;
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // Clean up expired sessions
      await this.prisma.session.deleteMany({
        where: {
          userId,
          expiresAt: { lt: new Date() },
        },
      });

      // Create new session
      await this.prisma.session.create({
        data: {
          userId,
          token,
          expiresAt,
        },
      });

      // Limit number of active sessions per user (optional)
      const sessionCount = await this.prisma.session.count({
        where: { userId },
      });

      if (sessionCount > 5) {
        // Delete oldest sessions, keep only 5 most recent
        const oldestSessions = await this.prisma.session.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          take: sessionCount - 5,
        });

        await this.prisma.session.deleteMany({
          where: {
            id: { in: oldestSessions.map((s) => s.id) },
          },
        });
      }
    } catch (error) {
      logger.error("Session creation failed:", error);
      // Don't throw error here to prevent breaking the auth flow
    }
  }

  /**
   * Format user profile response
   */
  private formatUserProfile(user: any): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userType: user.userType,
      organization: user.organization,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`Cleaned up ${result.count} expired sessions`);
    } catch (error) {
      logger.error("Session cleanup failed:", error);
    }
  }

  /**
   * Get user active sessions
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      }));
    } catch (error) {
      logger.error("Get user sessions failed:", error);
      throw new AppError(
        "Failed to get user sessions",
        500,
        "GET_SESSIONS_ERROR"
      );
    }
  }

  /**
   * Revoke specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    try {
      await this.prisma.session.deleteMany({
        where: {
          id: sessionId,
          userId,
        },
      });

      logger.info("Session revoked successfully", { userId, sessionId });
    } catch (error) {
      logger.error("Session revocation failed:", error);
      throw new AppError(
        "Session revocation failed",
        500,
        "REVOKE_SESSION_ERROR"
      );
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      return !!user;
    } catch (error) {
      logger.error("Email check failed:", error);
      return false;
    }
  }

  /**
   * Generate password reset token (placeholder for future implementation)
   */
  async generatePasswordResetToken(email: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }

      // Generate a secure random token
      const resetToken = BcryptUtil.generateSecurePassword(32);

      // In a real implementation, you would:
      // 1. Hash this token and store it in database with expiration
      // 2. Send email with the plain token
      // 3. When user submits reset form, hash the submitted token and compare

      logger.info("Password reset token generated", { userId: user.id });

      return resetToken;
    } catch (error) {
      logger.error("Password reset token generation failed:", error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        "Failed to generate reset token",
        500,
        "RESET_TOKEN_ERROR"
      );
    }
  }
}
