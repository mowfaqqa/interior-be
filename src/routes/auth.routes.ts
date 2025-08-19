import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  validateBody,
  validateParams,
} from "../middleware/validation.middleware";
import { authSchemas } from "../utils/validation";
import Joi from "joi";

const router = Router();
const authController = new AuthController();

// Validation schemas for auth routes
const sessionIdSchema = Joi.object({
  sessionId: Joi.string().required(),
});

const emailCheckSchema = Joi.object({
  email: Joi.string().email().required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

// Public routes (no authentication required)
router.post(
  "/register",
  validateBody(authSchemas.register),
  authController.register
);

router.post("/login", validateBody(authSchemas.login), authController.login);

router.post(
  "/refresh",
  validateBody(refreshTokenSchema),
  authController.refreshToken
);

router.post(
  "/check-email",
  validateBody(emailCheckSchema),
  authController.checkEmail
);

// Protected routes (authentication required)
router.use(authenticate);

router.get("/me", authController.getProfile);

router.put(
  "/profile",
  validateBody(authSchemas.updateProfile),
  authController.updateProfile
);

router.put(
  "/change-password",
  validateBody(authSchemas.changePassword),
  authController.changePassword
);

router.post("/logout", authController.logout);

router.post("/logout-all", authController.logoutAll);

router.get("/sessions", authController.getSessions);

router.delete(
  "/sessions/:sessionId",
  validateParams(sessionIdSchema),
  authController.revokeSession
);

export default router;
