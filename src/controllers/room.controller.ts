import { Response, NextFunction } from "express";
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateRoomDto,
  UpdateRoomDto,
} from "../types";
import { RoomService } from "../services/room.service";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class RoomController {
  private roomService: RoomService;

  constructor() {
    this.roomService = new RoomService(prisma);
  }

  /**
   * @swagger
   * /rooms:
   *   post:
   *     summary: Create a new room
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - projectId
   *               - type
   *               - length
   *               - width
   *               - height
   *               - materials
   *             properties:
   *               projectId:
   *                 type: string
   *                 example: clpv1234567890
   *               name:
   *                 type: string
   *                 example: Master Bedroom
   *               type:
   *                 type: string
   *                 enum: [LIVING_ROOM, BEDROOM, KITCHEN, BATHROOM, OFFICE, DINING_ROOM, BALCONY, STUDY, HALLWAY, OTHER]
   *                 example: BEDROOM
   *               length:
   *                 type: number
   *                 format: float
   *                 example: 4.5
   *               width:
   *                 type: number
   *                 format: float
   *                 example: 3.8
   *               height:
   *                 type: number
   *                 format: float
   *                 example: 2.7
   *               materials:
   *                 type: array
   *                 items:
   *                   type: string
   *                 example: ["wood", "marble", "steel"]
   *               ambientColor:
   *                 type: string
   *                 example: warm white
   *               freePrompt:
   *                 type: string
   *                 example: Add plants and natural lighting
   *     responses:
   *       201:
   *         description: Room created successfully
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
   *                   example: Room created successfully
   *                 data:
   *                   $ref: '#/components/schemas/Room'
   *       400:
   *         description: Validation error
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  createRoom = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const roomData: CreateRoomDto = req.body;
      const userId = req.user!.id;

      const room = await this.roomService.createRoom(userId, roomData);

      logger.info("Room created successfully", {
        roomId: room.id,
        projectId: roomData.projectId,
        userId,
        roomType: room.type,
      });

      res.status(201).json({
        success: true,
        message: "Room created successfully",
        data: room,
      });
    }
  );

  /**
   * @swagger
   * /rooms:
   *   get:
   *     summary: Get user rooms
   *     tags: [Rooms]
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
   *         name: projectId
   *         schema:
   *           type: string
   *         description: Filter by project ID
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [LIVING_ROOM, BEDROOM, KITCHEN, BATHROOM, OFFICE, DINING_ROOM, BALCONY, STUDY, HALLWAY, OTHER]
   *         description: Filter by room type
   *     responses:
   *       200:
   *         description: Rooms retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         description: Authentication required
   */
  getRooms = asyncHandler(
    async (req: AuthenticatedRequest, res: any, next: NextFunction) => {
      const userId = req.user!.id;
      const query = req.query;

      const result = await this.roomService.getRooms(userId, query);

      res.status(200).json({
        success: true,
        message: "Rooms retrieved successfully",
        data: result.rooms,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @swagger
   * /rooms/{id}:
   *   get:
   *     summary: Get room by ID
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Room ID
   *     responses:
   *       200:
   *         description: Room retrieved successfully
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
   *                   example: Room retrieved successfully
   *                 data:
   *                   $ref: '#/components/schemas/Room'
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  getRoom = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      const room = await this.roomService.getRoomById(id, userId);

      res.status(200).json({
        success: true,
        message: "Room retrieved successfully",
        data: room,
      });
    }
  );

  /**
   * @swagger
   * /rooms/{id}:
   *   put:
   *     summary: Update room
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Room ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: Updated Room Name
   *               type:
   *                 type: string
   *                 enum: [LIVING_ROOM, BEDROOM, KITCHEN, BATHROOM, OFFICE, DINING_ROOM, BALCONY, STUDY, HALLWAY, OTHER]
   *               length:
   *                 type: number
   *                 format: float
   *               width:
   *                 type: number
   *                 format: float
   *               height:
   *                 type: number
   *                 format: float
   *               materials:
   *                 type: array
   *                 items:
   *                   type: string
   *               ambientColor:
   *                 type: string
   *               freePrompt:
   *                 type: string
   *     responses:
   *       200:
   *         description: Room updated successfully
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
   *                   example: Room updated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Room'
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  updateRoom = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const updateData: UpdateRoomDto = req.body;
      const userId = req.user!.id;

      const room = await this.roomService.updateRoom(id, userId, updateData);

      logger.info("Room updated successfully", {
        roomId: id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      res.status(200).json({
        success: true,
        message: "Room updated successfully",
        data: room,
      });
    }
  );

  /**
   * @swagger
   * /rooms/{id}:
   *   delete:
   *     summary: Delete room
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Room ID
   *     responses:
   *       200:
   *         description: Room deleted successfully
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
   *                   example: Room deleted successfully
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  deleteRoom = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.roomService.deleteRoom(id, userId);

      logger.info("Room deleted successfully", {
        roomId: id,
        userId,
      });

      res.status(200).json({
        success: true,
        message: "Room deleted successfully",
      });
    }
  );

  /**
   * @swagger
   * /rooms/project/{projectId}:
   *   get:
   *     summary: Get rooms for a specific project
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Project rooms retrieved successfully
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
   *                   example: Project rooms retrieved successfully
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Room'
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  getProjectRooms = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { projectId } = req.params;
      const userId = req.user!.id;

      const rooms = await this.roomService.getProjectRooms(projectId, userId);

      res.status(200).json({
        success: true,
        message: "Project rooms retrieved successfully",
        data: rooms,
      });
    }
  );

  /**
   * @swagger
   * /rooms/{id}/image:
   *   put:
   *     summary: Update room image
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Room ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - imageUrl
   *             properties:
   *               imageUrl:
   *                 type: string
   *                 format: uri
   *                 example: https://res.cloudinary.com/example/image/upload/v1234567890/room.jpg
   *     responses:
   *       200:
   *         description: Room image updated successfully
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
   *                   example: Room image updated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Room'
   *       404:
   *         description: Room not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  updateRoomImage = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const { imageUrl } = req.body;
      const userId = req.user!.id;

      if (!imageUrl) {
        return res.status(400).json({
          success: false,
          message: "Image URL is required",
          error: "MISSING_IMAGE_URL",
        });
      }

      const room = await this.roomService.updateRoomImage(id, userId, imageUrl);

      logger.info("Room image updated successfully", {
        roomId: id,
        userId,
        imageUrl,
      });

      res.status(200).json({
        success: true,
        message: "Room image updated successfully",
        data: room,
      });
    }
  );

  /**
   * @swagger
   * /rooms/stats:
   *   get:
   *     summary: Get room statistics
   *     tags: [Rooms]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Room statistics retrieved successfully
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
   *                     totalRooms:
   *                       type: integer
   *                       example: 25
   *                     roomsByType:
   *                       type: object
   *                       example: { "LIVING_ROOM": 5, "BEDROOM": 8, "KITCHEN": 3 }
   *                     roomsByProject:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           projectId:
   *                             type: string
   *                           projectName:
   *                             type: string
   *                           roomCount:
   *                             type: integer
   *                     averageRoomSize:
   *                       type: number
   *                       example: 15.25
   *                     totalDesigns:
   *                       type: integer
   *                       example: 75
   *                     totalUploads:
   *                       type: integer
   *                       example: 40
   *       401:
   *         description: Authentication required
   */
  getRoomStats = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const stats = await this.roomService.getRoomStats(userId);

      res.status(200).json({
        success: true,
        message: "Room statistics retrieved successfully",
        data: stats,
      });
    }
  );
}
