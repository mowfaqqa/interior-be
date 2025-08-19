import { Router } from "express";
import { DesignController } from "../controllers/design.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validation.middleware";
import { designSchemas } from "../utils/validation";
import Joi from "joi";

const router = Router();
const designController = new DesignController();

// Validation schemas
const designIdSchema = Joi.object({
  id: Joi.string().required(),
});

const roomIdSchema = Joi.object({
  roomId: Joi.string().required(),
});

const regenerateDesignSchema = Joi.object({
  aiProvider: Joi.string().valid("openai", "replicate").optional(),
  customPrompt: Joi.string().trim().max(1000).optional(),
});

/**
 * @swagger
 * tags:
 *   name: Designs
 *   description: AI design generation endpoints
 */

// All design routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /designs:
 *   get:
 *     summary: Get user designs
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  validateQuery(designSchemas.query),
  designController.getDesigns
);

/**
 * @swagger
 * /designs/generate:
 *   post:
 *     summary: Generate AI design for a room
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/generate",
  validateBody(designSchemas.generate),
  designController.generateDesign
);

/**
 * @swagger
 * /designs/stats:
 *   get:
 *     summary: Get design statistics
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", designController.getDesignStats);

/**
 * @swagger
 * /designs/room/{roomId}:
 *   get:
 *     summary: Get designs for a specific room
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/room/:roomId",
  validateParams(roomIdSchema),
  designController.getRoomDesigns
);

/**
 * @swagger
 * /designs/{id}:
 *   get:
 *     summary: Get design by ID
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", validateParams(designIdSchema), designController.getDesign);

/**
 * @swagger
 * /designs/{id}:
 *   delete:
 *     summary: Delete design
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  validateParams(designIdSchema),
  designController.deleteDesign
);

/**
 * @swagger
 * /designs/{id}/regenerate:
 *   post:
 *     summary: Regenerate design
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/regenerate",
  validateParams(designIdSchema),
  validateBody(regenerateDesignSchema),
  designController.regenerateDesign
);

export default router;
