import { Router } from "express";
import { ProjectController } from "../controllers/project.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validation.middleware";
import { projectSchemas } from "../utils/validation";
import Joi from "joi";

const router = Router();
const projectController = new ProjectController();

// Validation schemas
const projectIdSchema = Joi.object({
  id: Joi.string().required(),
});

const duplicateProjectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
});

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management endpoints
 */

// All project routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get user projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  validateQuery(projectSchemas.query),
  projectController.getProjects
);

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  validateBody(projectSchemas.create),
  projectController.createProject
);

/**
 * @swagger
 * /projects/stats:
 *   get:
 *     summary: Get project statistics
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", projectController.getProjectStats);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  validateParams(projectIdSchema),
  projectController.getProject
);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  validateParams(projectIdSchema),
  validateBody(projectSchemas.update),
  projectController.updateProject
);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  validateParams(projectIdSchema),
  projectController.deleteProject
);

/**
 * @swagger
 * /projects/{id}/duplicate:
 *   post:
 *     summary: Duplicate project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/duplicate",
  validateParams(projectIdSchema),
  validateBody(duplicateProjectSchema),
  projectController.duplicateProject
);

export default router;
