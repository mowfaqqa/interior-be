import { Response, NextFunction } from "express";
import { AuthenticatedRequest, ApiResponse, GenerateDesignDto } from "../types";
import { DesignService } from "../services/design.service";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class DesignController {
  private designService: DesignService;

  constructor() {
    this.designService = new DesignService(prisma);
  }

  /**
   * @swagger
   * /designs/generate:
   *   post:
   *     summary: Generate AI design for a room
   *     tags: [Designs]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - roomId
   *             properties:
   *               roomId:
   *                 type: string
   *                 example: clpv1234567890
   *               customPrompt:
   *                 type: string
   *                 example: Add plants and natural lighting with modern furniture
   *               aiProvider:
   *                 type: string
   *                 enum: [openai, replicate]
   *                 default: replicate
   *                 example: replicate
   *     responses:
   *       201:
   *         description: Design generation initiated successfully
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
   *                   example: Design generation initiated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Design'
   *       400:
   *         description: Validation error
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   *       429:
   *         description: Rate limit exceeded
   */
  generateDesign = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const designData: GenerateDesignDto = req.body;
      const userId = req.user!.id;

      const design = await this.designService.generateDesign(
        userId,
        designData
      );

      logger.info("Design generation initiated", {
        designId: design.id,
        roomId: designData.roomId,
        userId,
        aiProvider: designData.aiProvider || "replicate",
      });

      res.status(201).json({
        success: true,
        message: "Design generation initiated successfully",
        data: design,
      });
    }
  );

  /**
   * @swagger
   * /designs:
   *   get:
   *     summary: Get user designs
   *     tags: [Designs]
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
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PENDING, PROCESSING, COMPLETED, FAILED]
   *         description: Filter by design status
   *       - in: query
   *         name: aiProvider
   *         schema:
   *           type: string
   *           enum: [openai, replicate]
   *         description: Filter by AI provider
   *     responses:
   *       200:
   *         description: Designs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         description: Authentication required
   */
  getDesigns = asyncHandler(
    async (req: AuthenticatedRequest, res: any, next: NextFunction) => {
      const userId = req.user!.id;
      const query = req.query;

      const result = await this.designService.getDesigns(userId, query);

      res.status(200).json({
        success: true,
        message: "Designs retrieved successfully",
        data: result.designs,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @swagger
   * /designs/{id}:
   *   get:
   *     summary: Get design by ID
   *     tags: [Designs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Design ID
   *     responses:
   *       200:
   *         description: Design retrieved successfully
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
   *                   example: Design retrieved successfully
   *                 data:
   *                   $ref: '#/components/schemas/Design'
   *       404:
   *         description: Design not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  getDesign = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      const design = await this.designService.getDesignById(id, userId);

      res.status(200).json({
        success: true,
        message: "Design retrieved successfully",
        data: design,
      });
    }
  );

  /**
   * @swagger
   * /designs/{id}:
   *   delete:
   *     summary: Delete design
   *     tags: [Designs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Design ID
   *     responses:
   *       200:
   *         description: Design deleted successfully
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
   *                   example: Design deleted successfully
   *       404:
   *         description: Design not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  deleteDesign = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.designService.deleteDesign(id, userId);

      logger.info("Design deleted successfully", {
        designId: id,
        userId,
      });

      res.status(200).json({
        success: true,
        message: "Design deleted successfully",
      });
    }
  );

  /**
   * @swagger
   * /designs/room/{roomId}:
   *   get:
   *     summary: Get designs for a specific room
   *     tags: [Designs]
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
   *         description: Room designs retrieved successfully
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
   *                   example: Room designs retrieved successfully
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Design'
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  getRoomDesigns = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { roomId } = req.params;
      const userId = req.user!.id;

      const designs = await this.designService.getRoomDesigns(roomId, userId);

      res.status(200).json({
        success: true,
        message: "Room designs retrieved successfully",
        data: designs,
      });
    }
  );

  /**
   * @swagger
   * /designs/stats:
   *   get:
   *     summary: Get design statistics
   *     tags: [Designs]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Design statistics retrieved successfully
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
   *                     totalDesigns:
   *                       type: integer
   *                       example: 150
   *                     designsByStatus:
   *                       type: object
   *                       example: { "COMPLETED": 120, "FAILED": 5, "PROCESSING": 2, "PENDING": 23 }
   *                     designsByProvider:
   *                       type: object
   *                       example: { "replicate": 100, "openai": 50 }
   *                     designsByRoomType:
   *                       type: object
   *                       example: { "LIVING_ROOM": 30, "BEDROOM": 40, "KITCHEN": 25 }
   *                     averageProcessingTime:
   *                       type: integer
   *                       example: 12500
   *                     successRate:
   *                       type: integer
   *                       example: 96
   *                     recentDesigns:
   *                       type: array
   *                       items:
   *                         type: object
   *       401:
   *         description: Authentication required
   */
  getDesignStats = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const stats = await this.designService.getDesignStats(userId);

      res.status(200).json({
        success: true,
        message: "Design statistics retrieved successfully",
        data: stats,
      });
    }
  );

  /**
   * @swagger
   * /designs/{id}/regenerate:
   *   post:
   *     summary: Regenerate design
   *     tags: [Designs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Design ID to regenerate
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               aiProvider:
   *                 type: string
   *                 enum: [openai, replicate]
   *                 example: replicate
   *               customPrompt:
   *                 type: string
   *                 example: Updated prompt with new requirements
   *     responses:
   *       201:
   *         description: Design regenerated successfully
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
   *                   example: Design regenerated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Design'
   *       404:
   *         description: Design not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   *       429:
   *         description: Rate limit exceeded
   */
  regenerateDesign = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const { aiProvider, customPrompt } = req.body;
      const userId = req.user!.id;

      const newDesign = await this.designService.regenerateDesign(id, userId, {
        aiProvider,
        customPrompt,
      });

      logger.info("Design regenerated successfully", {
        originalDesignId: id,
        newDesignId: newDesign.id,
        userId,
        aiProvider,
      });

      res.status(201).json({
        success: true,
        message: "Design regenerated successfully",
        data: newDesign,
      });
    }
  );
}
