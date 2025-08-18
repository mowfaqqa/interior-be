import { PrismaClient, DesignStatus } from "@prisma/client";
import { GenerateDesignDto, DesignQuery, AIPromptData } from "@/types";
import { AIService } from "@/services/ai.service";
import { AppError } from "@/middleware/error.middleware";
import logger from "@/utils/logger";

export class DesignService {
  private aiService: AIService;

  constructor(private prisma: PrismaClient) {
    this.aiService = new AIService();
  }

  /**
   * Generate AI design for a room
   */
  async generateDesign(
    userId: string,
    designData: GenerateDesignDto
  ): Promise<any> {
    try {
      const { roomId, customPrompt, aiProvider = "replicate" } = designData;

      // Get room details with project information
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          project: {
            select: {
              userId: true,
              style: true,
              type: true,
            },
          },
        },
      });

      if (!room) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      // Check ownership
      if (room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only generate designs for your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Create initial design record with PENDING status
      const design = await this.prisma.design.create({
        data: {
          roomId,
          imageUrl: "", // Will be updated after generation
          prompt: customPrompt || "", // Will be updated with generated prompt
          aiProvider,
          status: DesignStatus.PENDING,
        },
      });

      // Process design generation asynchronously
      this.processDesignGeneration(
        design.id,
        room,
        customPrompt,
        aiProvider
      ).catch((error) => {
        logger.error("Design generation processing failed:", error);
        // Update design status to FAILED
        this.prisma.design
          .update({
            where: { id: design.id },
            data: {
              status: DesignStatus.FAILED,
              error: error.message || "Design generation failed",
            },
          })
          .catch((updateError) => {
            logger.error(
              "Failed to update design status to FAILED:",
              updateError
            );
          });
      });

      logger.info("Design generation initiated", {
        designId: design.id,
        roomId,
        userId,
        aiProvider,
      });

      return this.formatDesignResponse(design);
    } catch (error) {
      logger.error("Design generation initiation failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to initiate design generation",
        500,
        "DESIGN_GENERATION_ERROR"
      );
    }
  }

  /**
   * Process design generation (async)
   */
  private async processDesignGeneration(
    designId: string,
    room: any,
    customPrompt?: string,
    aiProvider: "openai" | "replicate" = "replicate"
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to PROCESSING
      await this.prisma.design.update({
        where: { id: designId },
        data: { status: DesignStatus.PROCESSING },
      });

      // Prepare AI prompt data
      const promptData: AIPromptData = {
        roomType: room.type,
        style: room.project.style,
        dimensions: {
          length: room.length,
          width: room.width,
          height: room.height,
        },
        materials: room.materials,
        ambientColor: room.ambientColor,
        customPrompt,
      };

      // Generate design using AI service
      const aiResult = await this.aiService.generateDesign(promptData, {
        provider: aiProvider,
        inputImageUrl: room.originalImageUrl,
      });

      const processingTime = Date.now() - startTime;

      // Update design with results
      await this.prisma.design.update({
        where: { id: designId },
        data: {
          imageUrl: aiResult.imageUrls[0], // Use first generated image
          prompt: aiResult.prompt,
          status: DesignStatus.COMPLETED,
          processingTime,
          metadata: {
            ...aiResult.metadata,
            allImageUrls: aiResult.imageUrls, // Store all generated images
          },
        },
      });

      logger.info("Design generation completed successfully", {
        designId,
        processingTime,
        imageCount: aiResult.imageUrls.length,
        aiProvider,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error("Design generation processing failed:", error);

      // Update design status to FAILED
      await this.prisma.design.update({
        where: { id: designId },
        data: {
          status: DesignStatus.FAILED,
          processingTime,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * Get design by ID
   */
  async getDesignById(designId: string, userId: string): Promise<any> {
    try {
      const design = await this.prisma.design.findUnique({
        where: { id: designId },
        include: {
          room: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  style: true,
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!design) {
        throw new AppError("Design not found", 404, "DESIGN_NOT_FOUND");
      }

      // Check ownership
      if (design.room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view your own designs.",
          403,
          "ACCESS_DENIED"
        );
      }

      return this.formatDesignResponse(design, true);
    } catch (error) {
      logger.error("Get design by ID failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to get design", 500, "GET_DESIGN_ERROR");
    }
  }

  /**
   * Get designs for a room
   */
  async getRoomDesigns(roomId: string, userId: string): Promise<any[]> {
    try {
      // First verify the user owns the room
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          project: {
            select: { userId: true },
          },
        },
      });

      if (!room) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view designs from your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Get designs for the room
      const designs = await this.prisma.design.findMany({
        where: { roomId },
        orderBy: { createdAt: "desc" },
      });

      return designs.map((design) => this.formatDesignResponse(design));
    } catch (error) {
      logger.error("Get room designs failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to get room designs",
        500,
        "GET_ROOM_DESIGNS_ERROR"
      );
    }
  }

  /**
   * Get designs with pagination and filters
   */
  async getDesigns(
    userId: string,
    query: DesignQuery
  ): Promise<{
    designs: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20, roomId, status, aiProvider } = query;
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

      if (status) {
        whereClause.status = status;
      }

      if (aiProvider) {
        whereClause.aiProvider = aiProvider;
      }

      // Get total count
      const total = await this.prisma.design.count({
        where: whereClause,
      });

      // Get designs
      const designs = await this.prisma.design.findMany({
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
                  type: true,
                  style: true,
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
        designs: designs.map((design) => this.formatDesignResponse(design)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get designs failed:", error);
      throw new AppError("Failed to get designs", 500, "GET_DESIGNS_ERROR");
    }
  }

  /**
   * Delete design
   */
  async deleteDesign(designId: string, userId: string): Promise<void> {
    try {
      // First check if design exists and user owns it
      const existingDesign = await this.prisma.design.findUnique({
        where: { id: designId },
        include: {
          room: {
            include: {
              project: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (!existingDesign) {
        throw new AppError("Design not found", 404, "DESIGN_NOT_FOUND");
      }

      if (existingDesign.room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only delete your own designs.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Delete design
      await this.prisma.design.delete({
        where: { id: designId },
      });

      logger.info("Design deleted successfully", {
        designId,
        userId,
        roomId: existingDesign.roomId,
      });
    } catch (error) {
      logger.error("Design deletion failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to delete design", 500, "DESIGN_DELETE_ERROR");
    }
  }

  /**
   * Get design statistics
   */
  async getDesignStats(userId: string): Promise<{
    totalDesigns: number;
    designsByStatus: Record<string, number>;
    designsByProvider: Record<string, number>;
    designsByRoomType: Record<string, number>;
    averageProcessingTime: number;
    recentDesigns: any[];
    successRate: number;
  }> {
    try {
      // Get all user designs through their rooms
      const designs = await this.prisma.design.findMany({
        where: {
          room: {
            project: {
              userId,
            },
          },
        },
        include: {
          room: {
            select: {
              type: true,
              name: true,
              project: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const totalDesigns = designs.length;

      // Group by status
      const designsByStatus: Record<string, number> = {};
      designs.forEach((design) => {
        designsByStatus[design.status] =
          (designsByStatus[design.status] || 0) + 1;
      });

      // Group by AI provider
      const designsByProvider: Record<string, number> = {};
      designs.forEach((design) => {
        designsByProvider[design.aiProvider] =
          (designsByProvider[design.aiProvider] || 0) + 1;
      });

      // Group by room type
      const designsByRoomType: Record<string, number> = {};
      designs.forEach((design) => {
        const roomType = design.room.type;
        designsByRoomType[roomType] = (designsByRoomType[roomType] || 0) + 1;
      });

      // Calculate average processing time (only for completed designs)
      const completedDesigns = designs.filter(
        (d) => d.status === "COMPLETED" && d.processingTime
      );
      const totalProcessingTime = completedDesigns.reduce(
        (sum, d) => sum + (d.processingTime || 0),
        0
      );
      const averageProcessingTime =
        completedDesigns.length > 0
          ? Math.round(totalProcessingTime / completedDesigns.length)
          : 0;

      // Get recent designs (last 10)
      const recentDesigns = designs.slice(0, 10).map((design) => ({
        id: design.id,
        status: design.status,
        aiProvider: design.aiProvider,
        roomName: design.room.name,
        projectName: design.room.project.name,
        createdAt: design.createdAt.toISOString(),
        processingTime: design.processingTime,
      }));

      // Calculate success rate
      const completedCount = designsByStatus["COMPLETED"] || 0;
      const failedCount = designsByStatus["FAILED"] || 0;
      const totalProcessed = completedCount + failedCount;
      const successRate =
        totalProcessed > 0
          ? Math.round((completedCount / totalProcessed) * 100)
          : 0;

      return {
        totalDesigns,
        designsByStatus,
        designsByProvider,
        designsByRoomType,
        averageProcessingTime,
        recentDesigns,
        successRate,
      };
    } catch (error) {
      logger.error("Get design stats failed:", error);
      throw new AppError(
        "Failed to get design statistics",
        500,
        "GET_DESIGN_STATS_ERROR"
      );
    }
  }

  /**
   * Regenerate design
   */
  async regenerateDesign(
    designId: string,
    userId: string,
    options?: { aiProvider?: "openai" | "replicate"; customPrompt?: string }
  ): Promise<any> {
    try {
      // Get original design
      const originalDesign = await this.prisma.design.findUnique({
        where: { id: designId },
        include: {
          room: {
            include: {
              project: {
                select: {
                  userId: true,
                  style: true,
                  type: true,
                },
              },
            },
          },
        },
      });

      if (!originalDesign) {
        throw new AppError("Design not found", 404, "DESIGN_NOT_FOUND");
      }

      // Check ownership
      if (originalDesign.room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only regenerate your own designs.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Create new design based on original
      const newDesign = await this.generateDesign(userId, {
        roomId: originalDesign.roomId,
        customPrompt: options?.customPrompt || originalDesign.prompt,
        aiProvider:
          options?.aiProvider ||
          (originalDesign.aiProvider as "openai" | "replicate"),
      });

      logger.info("Design regenerated successfully", {
        originalDesignId: designId,
        newDesignId: newDesign.id,
        userId,
      });

      return newDesign;
    } catch (error) {
      logger.error("Design regeneration failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to regenerate design",
        500,
        "DESIGN_REGENERATION_ERROR"
      );
    }
  }

  /**
   * Format design response
   */
  private formatDesignResponse(
    design: any,
    includeRoomDetails: boolean = false
  ): any {
    const formatted = {
      id: design.id,
      roomId: design.roomId,
      imageUrl: design.imageUrl,
      prompt: design.prompt,
      aiProvider: design.aiProvider,
      status: design.status,
      processingTime: design.processingTime,
      error: design.error,
      metadata: design.metadata,
      createdAt: design.createdAt.toISOString(),
      updatedAt: design.updatedAt.toISOString(),
    };

    // Add room information if available
    if (includeRoomDetails && design.room) {
      (formatted as any).room = {
        id: design.room.id,
        name: design.room.name,
        type: design.room.type,
        length: design.room.length,
        width: design.room.width,
        height: design.room.height,
        materials: design.room.materials,
        ambientColor: design.room.ambientColor,
        freePrompt: design.room.freePrompt,
        originalImageUrl: design.room.originalImageUrl,
        project: design.room.project && {
          id: design.room.project.id,
          name: design.room.project.name,
          type: design.room.project.type,
          style: design.room.project.style,
        },
      };
    }

    // Add all generated image URLs if available in metadata
    if (design.metadata?.allImageUrls) {
      (formatted as any).allImageUrls = design.metadata.allImageUrls;
    }

    return formatted;
  }
}
