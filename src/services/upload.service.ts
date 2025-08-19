import { PrismaClient } from "@prisma/client";
import { CloudinaryUtil } from "../utils/cloudinary";
import { AppError } from "../middleware/error.middleware";
import { createSafeFilename } from "../middleware/upload.middleware";
import logger from "../utils/logger";

export class UploadService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Upload room image
   */
  async uploadRoomImage(
    file: Express.Multer.File,
    options: {
      roomId?: string;
      userId: string;
    }
  ): Promise<{
    upload: any;
    url: string;
    thumbnailUrl: string;
    responsiveUrls: any;
  }> {
    try {
      // Generate safe filename
      const safeFilename = createSafeFilename(file.originalname);

      // Upload to Cloudinary
      const cloudinaryResult = await CloudinaryUtil.uploadImage(file.buffer, {
        folder: "interior-design/room-images",
        public_id: safeFilename.split(".")[0], // Remove extension for public_id
        transformation: {
          quality: "auto",
          fetch_format: "auto",
        },
      });

      // Save upload record to database
      const upload = await this.prisma.upload.create({
        data: {
          roomId: options.roomId || null,
          filename: safeFilename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: cloudinaryResult.secure_url,
          cloudinaryId: cloudinaryResult.public_id,
          metadata: {
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            format: cloudinaryResult.format,
            bytes: cloudinaryResult.bytes,
            uploadedBy: options.userId,
          },
        },
      });

      // Generate responsive URLs
      const responsiveUrls = CloudinaryUtil.generateResponsiveUrls(
        cloudinaryResult.public_id
      );
      const thumbnailUrl = CloudinaryUtil.generateThumbnailUrl(
        cloudinaryResult.public_id
      );

      logger.info("Room image uploaded successfully", {
        uploadId: upload.id,
        filename: safeFilename,
        size: file.size,
        roomId: options.roomId,
        userId: options.userId,
      });

      return {
        upload: {
          id: upload.id,
          filename: upload.filename,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          size: upload.size,
          url: upload.url,
          cloudinaryId: upload.cloudinaryId,
          createdAt: upload.createdAt.toISOString(),
        },
        url: cloudinaryResult.secure_url,
        thumbnailUrl,
        responsiveUrls,
      };
    } catch (error) {
      logger.error("Room image upload failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to upload room image", 500, "UPLOAD_ERROR");
    }
  }

  /**
   * Get upload by ID
   */
  async getUploadById(uploadId: string): Promise<any> {
    try {
      const upload = await this.prisma.upload.findUnique({
        where: { id: uploadId },
        include: {
          room: {
            select: {
              id: true,
              name: true,
              type: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!upload) {
        throw new AppError("Upload not found", 404, "UPLOAD_NOT_FOUND");
      }

      return {
        id: upload.id,
        filename: upload.filename,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        size: upload.size,
        url: upload.url,
        cloudinaryId: upload.cloudinaryId,
        metadata: upload.metadata,
        createdAt: upload.createdAt.toISOString(),
        room: upload.room,
      };
    } catch (error) {
      logger.error("Get upload failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to get upload", 500, "GET_UPLOAD_ERROR");
    }
  }

  /**
   * Delete upload
   */
  async deleteUpload(uploadId: string, userId: string): Promise<void> {
    try {
      // Get upload with room information to check ownership
      const upload = await this.prisma.upload.findUnique({
        where: { id: uploadId },
        include: {
          room: {
            select: {
              project: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!upload) {
        throw new AppError("Upload not found", 404, "UPLOAD_NOT_FOUND");
      }

      // Check ownership
      if (upload.room?.project?.userId !== userId) {
        throw new AppError(
          "Access denied. You can only delete your own uploads.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Delete from Cloudinary if cloudinaryId exists
      if (upload.cloudinaryId) {
        try {
          await CloudinaryUtil.deleteImage(upload.cloudinaryId);
        } catch (cloudinaryError) {
          logger.warn(
            "Failed to delete image from Cloudinary:",
            cloudinaryError
          );
          // Continue with database deletion even if Cloudinary deletion fails
        }
      }

      // Delete from database
      await this.prisma.upload.delete({
        where: { id: uploadId },
      });

      logger.info("Upload deleted successfully", {
        uploadId,
        filename: upload.filename,
        userId,
      });
    } catch (error) {
      logger.error("Delete upload failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to delete upload", 500, "DELETE_UPLOAD_ERROR");
    }
  }

  /**
   * Get uploads for a room
   */
  async getRoomUploads(roomId: string, userId: string): Promise<any[]> {
    try {
      // First verify the user owns the room
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        select: {
          project: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!room) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view your own room uploads.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Get uploads for the room
      const uploads = await this.prisma.upload.findMany({
        where: { roomId },
        orderBy: { createdAt: "desc" },
      });

      return uploads.map((upload) => ({
        id: upload.id,
        filename: upload.filename,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        size: upload.size,
        url: upload.url,
        cloudinaryId: upload.cloudinaryId,
        metadata: upload.metadata,
        createdAt: upload.createdAt.toISOString(),
        // Add responsive URLs if cloudinaryId exists
        ...(upload.cloudinaryId && {
          responsiveUrls: CloudinaryUtil.generateResponsiveUrls(
            upload.cloudinaryId
          ),
          thumbnailUrl: CloudinaryUtil.generateThumbnailUrl(
            upload.cloudinaryId
          ),
        }),
      }));
    } catch (error) {
      logger.error("Get room uploads failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to get room uploads",
        500,
        "GET_ROOM_UPLOADS_ERROR"
      );
    }
  }

  /**
   * Update upload room association
   */
  async updateUploadRoom(
    uploadId: string,
    roomId: string,
    userId: string
  ): Promise<any> {
    try {
      // Verify upload exists and user has access
      const upload = await this.prisma.upload.findUnique({
        where: { id: uploadId },
        include: {
          room: {
            select: {
              project: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!upload) {
        throw new AppError("Upload not found", 404, "UPLOAD_NOT_FOUND");
      }

      // If upload already has a room, check ownership
      if (upload.room && upload.room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only modify your own uploads.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Verify new room exists and user owns it
      const newRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        select: {
          project: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!newRoom) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (newRoom.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only associate uploads with your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Update upload
      const updatedUpload = await this.prisma.upload.update({
        where: { id: uploadId },
        data: { roomId },
      });

      logger.info("Upload room association updated", {
        uploadId,
        newRoomId: roomId,
        userId,
      });

      return {
        id: updatedUpload.id,
        filename: updatedUpload.filename,
        originalName: updatedUpload.originalName,
        mimeType: updatedUpload.mimeType,
        size: updatedUpload.size,
        url: updatedUpload.url,
        cloudinaryId: updatedUpload.cloudinaryId,
        roomId: updatedUpload.roomId,
        metadata: updatedUpload.metadata,
        createdAt: updatedUpload.createdAt.toISOString(),
        updatedAt: updatedUpload.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error("Update upload room failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to update upload room association",
        500,
        "UPDATE_UPLOAD_ROOM_ERROR"
      );
    }
  }

  /**
   * Get user's all uploads
   */
  async getUserUploads(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      roomId?: string;
    } = {}
  ): Promise<{
    uploads: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20, roomId } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        room: {
          project: {
            userId,
          },
        },
      };

      if (roomId) {
        whereClause.roomId = roomId;
      }

      // Get total count
      const total = await this.prisma.upload.count({
        where: whereClause,
      });

      // Get uploads
      const uploads = await this.prisma.upload.findMany({
        where: whereClause,
        include: {
          room: {
            select: {
              id: true,
              name: true,
              type: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        uploads: uploads.map((upload) => ({
          id: upload.id,
          filename: upload.filename,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          size: upload.size,
          url: upload.url,
          cloudinaryId: upload.cloudinaryId,
          metadata: upload.metadata,
          createdAt: upload.createdAt.toISOString(),
          room: upload.room,
          // Add responsive URLs if cloudinaryId exists
          ...(upload.cloudinaryId && {
            responsiveUrls: CloudinaryUtil.generateResponsiveUrls(
              upload.cloudinaryId
            ),
            thumbnailUrl: CloudinaryUtil.generateThumbnailUrl(
              upload.cloudinaryId
            ),
          }),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get user uploads failed:", error);
      throw new AppError(
        "Failed to get user uploads",
        500,
        "GET_USER_UPLOADS_ERROR"
      );
    }
  }

  /**
   * Clean up orphaned uploads (uploads not associated with any room)
   */
  async cleanupOrphanedUploads(
    olderThanDays: number = 7
  ): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find orphaned uploads
      const orphanedUploads = await this.prisma.upload.findMany({
        where: {
          roomId: null,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      let deletedCount = 0;

      // Delete each orphaned upload
      for (const upload of orphanedUploads) {
        try {
          // Delete from Cloudinary if cloudinaryId exists
          if (upload.cloudinaryId) {
            await CloudinaryUtil.deleteImage(upload.cloudinaryId);
          }

          // Delete from database
          await this.prisma.upload.delete({
            where: { id: upload.id },
          });

          deletedCount++;
        } catch (error) {
          logger.warn("Failed to delete orphaned upload:", {
            uploadId: upload.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      logger.info("Orphaned uploads cleanup completed", {
        deletedCount,
        totalFound: orphanedUploads.length,
        olderThanDays,
      });

      return { deletedCount };
    } catch (error) {
      logger.error("Cleanup orphaned uploads failed:", error);
      throw new AppError(
        "Failed to cleanup orphaned uploads",
        500,
        "CLEANUP_UPLOADS_ERROR"
      );
    }
  }

  /**
   * Get upload statistics for user
   */
  async getUploadStats(userId: string): Promise<{
    totalUploads: number;
    totalSize: number;
    totalSizeMB: number;
    uploadsByType: Record<string, number>;
    recentUploads: number;
  }> {
    try {
      // Get all user uploads through their rooms
      const uploads = await this.prisma.upload.findMany({
        where: {
          room: {
            project: {
              userId,
            },
          },
        },
        select: {
          size: true,
          mimeType: true,
          createdAt: true,
        },
      });

      // Calculate statistics
      const totalUploads = uploads.length;
      const totalSize = uploads.reduce((sum, upload) => sum + upload.size, 0);
      const totalSizeMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;

      // Group by MIME type
      const uploadsByType: Record<string, number> = {};
      uploads.forEach((upload) => {
        uploadsByType[upload.mimeType] =
          (uploadsByType[upload.mimeType] || 0) + 1;
      });

      // Count recent uploads (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentUploads = uploads.filter(
        (upload) => upload.createdAt > sevenDaysAgo
      ).length;

      return {
        totalUploads,
        totalSize,
        totalSizeMB,
        uploadsByType,
        recentUploads,
      };
    } catch (error) {
      logger.error("Get upload stats failed:", error);
      throw new AppError(
        "Failed to get upload statistics",
        500,
        "GET_UPLOAD_STATS_ERROR"
      );
    }
  }

  /**
   * Generate signed URL for direct upload
   */
  async generateSignedUploadUrl(
    userId: string,
    options: {
      folder?: string;
      eager?: string;
    } = {}
  ): Promise<{
    url: string;
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
    folder: string;
  }> {
    try {
      const { folder = `interior-design/user-${userId}`, eager } = options;

      const signedData = CloudinaryUtil.generateSignedUploadUrl({
        folder,
        eager,
      });

      logger.info("Signed upload URL generated", {
        userId,
        folder,
        timestamp: signedData.timestamp,
      });

      return {
        ...signedData,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
        apiKey: process.env.CLOUDINARY_API_KEY!,
        folder,
      };
    } catch (error) {
      logger.error("Generate signed upload URL failed:", error);
      throw new AppError(
        "Failed to generate signed upload URL",
        500,
        "SIGNED_URL_ERROR"
      );
    }
  }

  /**
   * Validate and process uploaded file metadata
   */
  validateFileMetadata(file: Express.Multer.File): {
    isValid: boolean;
    errors: string[];
    metadata: any;
  } {
    const errors: string[] = [];
    const metadata: any = {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      errors.push("File size exceeds maximum limit of 10MB");
    }

    if (file.size < 1024) {
      // 1KB
      errors.push("File size is too small (minimum 1KB)");
    }

    // Validate MIME type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
      );
    }

    // Validate filename
    if (file.originalname.length > 255) {
      errors.push("Filename is too long (maximum 255 characters)");
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".scr",
      ".com",
      ".pif",
    ];
    const hasSupiciousExtension = suspiciousExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasSupiciousExtension) {
      errors.push("File type not allowed for security reasons");
    }

    return {
      isValid: errors.length === 0,
      errors,
      metadata,
    };
  }
}
