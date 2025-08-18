import { Router } from "express";
import { UploadController } from "@/controllers/upload.controller";
import { authenticate } from "@/middleware/auth.middleware";
import {
  uploadSingle,
  validateUploadedFile,
  generateSafeFilename,
  cleanupTempFiles,
} from "@/middleware/upload.middleware";
import {
  validateFile,
  validateParams,
  validateQuery,
} from "@/middleware/validation.middleware";
import Joi from "joi";

const router = Router();
const uploadController = new UploadController();

// Validation schemas
const uploadIdSchema = Joi.object({
  id: Joi.string().required(),
});

const roomIdSchema = Joi.object({
  roomId: Joi.string().optional(),
});

const uploadQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  roomId: Joi.string().optional(),
});

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: File upload management
 */

// All upload routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /uploads/room-image:
 *   post:
 *     summary: Upload room image
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, WebP)
 *               roomId:
 *                 type: string
 *                 description: Optional room ID to associate with upload
 *     responses:
 *       201:
 *         description: Image uploaded successfully
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
 *                   example: Image uploaded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     upload:
 *                       $ref: '#/components/schemas/Upload'
 *                     url:
 *                       type: string
 *                       format: uri
 *                     thumbnailUrl:
 *                       type: string
 *                       format: uri
 *                     responsiveUrls:
 *                       type: object
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Authentication required
 */
router.post(
  "/room-image",
  uploadSingle("file"),
  validateFile({ required: true, maxSize: 10 * 1024 * 1024 }), // 10MB
  validateUploadedFile,
  generateSafeFilename,
  uploadController.uploadRoomImage,
  cleanupTempFiles
);

/**
 * @swagger
 * /uploads/{id}:
 *   get:
 *     summary: Get upload by ID
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload ID
 *     responses:
 *       200:
 *         description: Upload retrieved successfully
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
 *                   example: Upload retrieved successfully
 *                 data:
 *                   $ref: '#/components/schemas/Upload'
 *       404:
 *         description: Upload not found
 *       401:
 *         description: Authentication required
 */
router.get("/:id", validateParams(uploadIdSchema), uploadController.getUpload);

/**
 * @swagger
 * /uploads/{id}:
 *   delete:
 *     summary: Delete upload
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Upload ID
 *     responses:
 *       200:
 *         description: Upload deleted successfully
 *       404:
 *         description: Upload not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Authentication required
 */
router.delete(
  "/:id",
  validateParams(uploadIdSchema),
  uploadController.deleteUpload
);

/**
 * @swagger
 * /uploads:
 *   get:
 *     summary: Get user uploads
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *         description: Filter by room ID
 *     responses:
 *       200:
 *         description: Uploads retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Authentication required
 */
router.get(
  "/",
  validateQuery(uploadQuerySchema),
  uploadController.getUserUploads
);

/**
 * @swagger
 * /uploads/room/{roomId}:
 *   get:
 *     summary: Get uploads for a specific room
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room uploads retrieved successfully
 *       404:
 *         description: Room not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Authentication required
 */
router.get(
  "/room/:roomId",
  validateParams(Joi.object({ roomId: Joi.string().required() })),
  uploadController.getRoomUploads
);

/**
 * @swagger
 * /uploads/stats:
 *   get:
 *     summary: Get upload statistics
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upload statistics retrieved successfully
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
 *                   example: Statistics retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUploads:
 *                       type: integer
 *                       example: 25
 *                     totalSize:
 *                       type: integer
 *                       example: 52428800
 *                     totalSizeMB:
 *                       type: number
 *                       example: 50.0
 *                     uploadsByType:
 *                       type: object
 *                       example: { "image/jpeg": 15, "image/png": 10 }
 *                     recentUploads:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Authentication required
 */
router.get("/stats", uploadController.getUploadStats);

/**
 * @swagger
 * /uploads/signed-url:
 *   post:
 *     summary: Generate signed URL for direct upload
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folder:
 *                 type: string
 *                 example: custom-folder
 *               eager:
 *                 type: string
 *                 example: w_400,h_400,c_crop
 *     responses:
 *       200:
 *         description: Signed URL generated successfully
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
 *                   example: Signed URL generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     signature:
 *                       type: string
 *                     timestamp:
 *                       type: integer
 *                     cloudName:
 *                       type: string
 *                     apiKey:
 *                       type: string
 *                     folder:
 *                       type: string
 *       401:
 *         description: Authentication required
 */
router.post("/signed-url", uploadController.generateSignedUploadUrl);

export default router;
