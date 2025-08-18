import { Router } from "express";
import { RoomController } from "@/controllers/room.controller";
import { authenticate } from "@/middleware/auth.middleware";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "@/middleware/validation.middleware";
import { roomSchemas } from "@/utils/validation";
import Joi from "joi";

const router = Router();
const roomController = new RoomController();

// Validation schemas
const roomIdSchema = Joi.object({
  id: Joi.string().required(),
});

const projectIdSchema = Joi.object({
  projectId: Joi.string().required(),
});

const updateImageSchema = Joi.object({
  imageUrl: Joi.string().uri().required(),
});

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room management endpoints
 */

// All room routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get user rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", validateQuery(roomSchemas.query), roomController.getRooms);

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", validateBody(roomSchemas.create), roomController.createRoom);

/**
 * @swagger
 * /rooms/stats:
 *   get:
 *     summary: Get room statistics
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", roomController.getRoomStats);

/**
 * @swagger
 * /rooms/project/{projectId}:
 *   get:
 *     summary: Get rooms for a specific project
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/project/:projectId",
  validateParams(projectIdSchema),
  roomController.getProjectRooms
);

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", validateParams(roomIdSchema), roomController.getRoom);

/**
 * @swagger
 * /rooms/{id}:
 *   put:
 *     summary: Update room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  validateParams(roomIdSchema),
  validateBody(roomSchemas.update),
  roomController.updateRoom
);

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Delete room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", validateParams(roomIdSchema), roomController.deleteRoom);

/**
 * @swagger
 * /rooms/{id}/image:
 *   put:
 *     summary: Update room image
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/image",
  validateParams(roomIdSchema),
  validateBody(updateImageSchema),
  roomController.updateRoomImage
);

export default router;
