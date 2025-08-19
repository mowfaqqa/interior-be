import { Response, NextFunction } from "express";
import {
  AuthenticatedRequest,
  ApiResponse,
  RegisterDto,
  LoginDto,
} from "../types";
import { AuthService } from "../services/auth.service";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService(prisma);
  }

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - name
   *               - password
   *               - userType
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               name:
   *                 type: string
   *                 example: John Doe
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 example: SecurePass123!
   *               userType:
   *                 type: string
   *                 enum: [INDIVIDUAL, BUSINESS]
   *                 example: INDIVIDUAL
   *               organization:
   *                 type: string
   *                 example: Acme Corp
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: User registered successfully
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     token:
   *                       type: string
   *                     refreshToken:
   *                       type: string
   *                     expiresIn:
   *                       type: string
   *       400:
   *         description: Validation error
   *       409:
   *         description: User already exists
   */
  register = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userData: RegisterDto = req.body;

      const result = await this.authService.register(userData);

      logger.info("User registration successful", {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: result,
      });
    }
  );

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Login user
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               password:
   *                 type: string
   *                 example: SecurePass123!
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Login successful
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     token:
   *                       type: string
   *                     refreshToken:
   *                       type: string
   *                     expiresIn:
   *                       type: string
   *       401:
   *         description: Invalid credentials
   */
  login = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const loginData: LoginDto = req.body;

      const result = await this.authService.login(loginData);

      logger.info("User login successful", {
        userId: result.user.id,
        email: result.user.email,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: result,
      });
    }
  );

  /**
   * @swagger
   * /auth/refresh:
   *   post:
   *     summary: Refresh access token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *       401:
   *         description: Invalid refresh token
   */
  refreshToken = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
          error: "MISSING_REFRESH_TOKEN",
        });
      }

      const result = await this.authService.refreshToken(refreshToken);

      logger.info("Token refreshed successfully", {
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: result,
      });
    }
  );

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Logout user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *       401:
   *         description: Authentication required
   */
  logout = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const authHeader = req.header("Authorization");
      const token = authHeader?.replace("Bearer ", "") || "";

      await this.authService.logout(token);

      logger.info("User logout successful", {
        userId: req.user?.id,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    }
  );

  /**
   * @swagger
   * /auth/logout-all:
   *   post:
   *     summary: Logout from all devices
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logged out from all devices
   *       401:
   *         description: Authentication required
   */
  logoutAll = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      await this.authService.logoutAllDevices(userId);

      logger.info("User logout from all devices successful", {
        userId,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Logged out from all devices successfully",
      });
    }
  );

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current user profile
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Profile retrieved successfully
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Authentication required
   */
  getProfile = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const profile = await this.authService.getProfile(userId);

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: profile,
      });
    }
  );

  /**
   * @swagger
   * /auth/profile:
   *   put:
   *     summary: Update user profile
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: John Smith
   *               organization:
   *                 type: string
   *                 example: New Company Inc
   *     responses:
   *       200:
   *         description: Profile updated successfully
   *       401:
   *         description: Authentication required
   */
  updateProfile = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;
      const updateData = req.body;

      const profile = await this.authService.updateProfile(userId, updateData);

      logger.info("User profile updated", {
        userId,
        updatedFields: Object.keys(updateData),
      });

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: profile,
      });
    }
  );

  /**
   * @swagger
   * /auth/change-password:
   *   put:
   *     summary: Change user password
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *                 example: OldPassword123!
   *               newPassword:
   *                 type: string
   *                 example: NewPassword456!
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Invalid current password or weak new password
   *       401:
   *         description: Authentication required
   */
  changePassword = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await this.authService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      logger.info("User password changed", {
        userId,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message:
          "Password changed successfully. Please login with your new password.",
      });
    }
  );

  /**
   * @swagger
   * /auth/sessions:
   *   get:
   *     summary: Get user active sessions
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Sessions retrieved successfully
   *       401:
   *         description: Authentication required
   */
  getSessions = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const sessions = await this.authService.getUserSessions(userId);

      res.status(200).json({
        success: true,
        message: "Sessions retrieved successfully",
        data: sessions,
      });
    }
  );

  /**
   * @swagger
   * /auth/sessions/{sessionId}:
   *   delete:
   *     summary: Revoke specific session
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: Session ID to revoke
   *     responses:
   *       200:
   *         description: Session revoked successfully
   *       401:
   *         description: Authentication required
   *       404:
   *         description: Session not found
   */
  revokeSession = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;
      const { sessionId } = req.params;

      await this.authService.revokeSession(userId, sessionId);

      logger.info("Session revoked", {
        userId,
        sessionId,
        ip: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Session revoked successfully",
      });
    }
  );

  /**
   * @swagger
   * /auth/check-email:
   *   post:
   *     summary: Check if email exists
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *     responses:
   *       200:
   *         description: Email check completed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Email check completed
   *                 data:
   *                   type: object
   *                   properties:
   *                     exists:
   *                       type: boolean
   *                       example: false
   */
  checkEmail = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
          error: "MISSING_EMAIL",
        });
      }

      const exists = await this.authService.emailExists(email);

      res.status(200).json({
        success: true,
        message: "Email check completed",
        data: { exists },
      });
    }
  );
}
