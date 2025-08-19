import { Response, NextFunction } from "express";
import { AuthenticatedRequest, ApiResponse } from "../types";
import { UploadService } from "../services/upload.service";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class UploadController {
  private uploadService: UploadService;

  constructor() {
    this.uploadService = new UploadService(prisma);
  }

  /**
   * Upload room image
   */
  uploadRoomImage = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const file = req.file;
      const { roomId } = req.body;
      const userId = req.user!.id;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "File is required",
          error: "MISSING_FILE",
        });
      }

      const result = await this.uploadService.uploadRoomImage(file, {
        roomId,
        userId,
      });

      logger.info("Room image uploaded successfully", {
        uploadId: result.upload.id,
        userId,
        filename: result.upload.filename,
        size: result.upload.size,
      });

      res.status(201).json({
        success: true,
        message: "Image uploaded successfully",
        data: result,
      });
    }
  );

  /**
   * Get upload by ID
   */
  getUpload = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;

      const upload = await this.uploadService.getUploadById(id);

      res.status(200).json({
        success: true,
        message: "Upload retrieved successfully",
        data: upload,
      });
    }
  );

  /**
   * Delete upload
   */
  deleteUpload = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.uploadService.deleteUpload(id, userId);

      logger.info("Upload deleted successfully", {
        uploadId: id,
        userId,
      });

      res.status(200).json({
        success: true,
        message: "Upload deleted successfully",
      });
    }
  );

  /**
   * Get user uploads
   */
  getUserUploads = asyncHandler(
    async (req: AuthenticatedRequest, res: any, next: NextFunction) => {
      const userId = req.user!.id;
      const { page, limit, roomId } = req.query;

      const result = await this.uploadService.getUserUploads(userId, {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 20,
        roomId: roomId as string,
      });

      res.status(200).json({
        success: true,
        message: "Uploads retrieved successfully",
        data: result.uploads,
        pagination: result.pagination,
      });
    }
  );

  /**
   * Get room uploads
   */
  getRoomUploads = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { roomId } = req.params;
      const userId = req.user!.id;

      const uploads = await this.uploadService.getRoomUploads(roomId, userId);

      res.status(200).json({
        success: true,
        message: "Room uploads retrieved successfully",
        data: uploads,
      });
    }
  );

  /**
   * Get upload statistics
   */
  getUploadStats = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const stats = await this.uploadService.getUploadStats(userId);

      res.status(200).json({
        success: true,
        message: "Upload statistics retrieved successfully",
        data: stats,
      });
    }
  );

  /**
   * Generate signed upload URL
   */
  generateSignedUploadUrl = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;
      const { folder, eager } = req.body;

      const signedData = await this.uploadService.generateSignedUploadUrl(
        userId,
        {
          folder,
          eager,
        }
      );

      res.status(200).json({
        success: true,
        message: "Signed URL generated successfully",
        data: signedData,
      });
    }
  );
}
