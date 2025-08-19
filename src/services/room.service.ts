import { PrismaClient } from "@prisma/client";
import { CreateRoomDto, UpdateRoomDto, RoomQuery } from "../types";
import { AppError } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class RoomService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new room
   */
  async createRoom(userId: string, roomData: CreateRoomDto): Promise<any> {
    try {
      // First, verify that the project exists and belongs to the user
      const project = await this.prisma.project.findUnique({
        where: { id: roomData.projectId },
        select: { userId: true, name: true },
      });

      if (!project) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      if (project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only add rooms to your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Create the room
      const room = await this.prisma.room.create({
        data: roomData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true,
              style: true,
            },
          },
          designs: {
            select: {
              id: true,
              imageUrl: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          uploads: {
            select: {
              id: true,
              url: true,
              filename: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      logger.info("Room created successfully", {
        roomId: room.id,
        projectId: roomData.projectId,
        userId,
        roomType: room.type,
      });

      return this.formatRoomResponse(room);
    } catch (error) {
      logger.error("Room creation failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to create room", 500, "ROOM_CREATION_ERROR");
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId: string, userId: string): Promise<any> {
    try {
      const room = await this.prisma.room.findUnique({
        where: { id: roomId },
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
          designs: {
            orderBy: { createdAt: "desc" },
          },
          uploads: {
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      if (!room) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      // Check ownership through project
      if (room.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      return this.formatRoomResponse(room, true);
    } catch (error) {
      logger.error("Get room by ID failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to get room", 500, "GET_ROOM_ERROR");
    }
  }

  /**
   * Update room
   */
  async updateRoom(
    roomId: string,
    userId: string,
    updateData: UpdateRoomDto
  ): Promise<any> {
    try {
      // First check if room exists and user owns it
      const existingRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          project: {
            select: { userId: true },
          },
        },
      });

      if (!existingRoom) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (existingRoom.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only update your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Update room
      const room = await this.prisma.room.update({
        where: { id: roomId },
        data: updateData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true,
              style: true,
            },
          },
          designs: {
            select: {
              id: true,
              imageUrl: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          uploads: {
            select: {
              id: true,
              url: true,
              filename: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      logger.info("Room updated successfully", {
        roomId,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return this.formatRoomResponse(room);
    } catch (error) {
      logger.error("Room update failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to update room", 500, "ROOM_UPDATE_ERROR");
    }
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    try {
      // First check if room exists and user owns it
      const existingRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          project: {
            select: { userId: true },
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      if (!existingRoom) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (existingRoom.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only delete your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Delete room (cascade delete will handle designs and uploads)
      await this.prisma.room.delete({
        where: { id: roomId },
      });

      logger.info("Room deleted successfully", {
        roomId,
        userId,
        designsDeleted: existingRoom._count.designs,
        uploadsDeleted: existingRoom._count.uploads,
      });
    } catch (error) {
      logger.error("Room deletion failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to delete room", 500, "ROOM_DELETE_ERROR");
    }
  }

  /**
   * Get rooms with pagination and filters
   */
  async getRooms(
    userId: string,
    query: RoomQuery
  ): Promise<{
    rooms: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20, projectId, type } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        project: {
          userId,
        },
      };

      if (projectId) {
        whereClause.projectId = projectId;
      }

      if (type) {
        whereClause.type = type;
      }

      // Get total count
      const total = await this.prisma.room.count({
        where: whereClause,
      });

      // Get rooms
      const rooms = await this.prisma.room.findMany({
        where: whereClause,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true,
              style: true,
            },
          },
          designs: {
            select: {
              id: true,
              imageUrl: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          uploads: {
            select: {
              id: true,
              url: true,
              filename: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        rooms: rooms.map((room) => this.formatRoomResponse(room)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get rooms failed:", error);
      throw new AppError("Failed to get rooms", 500, "GET_ROOMS_ERROR");
    }
  }

  /**
   * Get project rooms
   */
  async getProjectRooms(projectId: string, userId: string): Promise<any[]> {
    try {
      // First verify the user owns the project
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });

      if (!project) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      if (project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view rooms from your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Get rooms for the project
      const rooms = await this.prisma.room.findMany({
        where: { projectId },
        include: {
          designs: {
            select: {
              id: true,
              imageUrl: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          uploads: {
            select: {
              id: true,
              url: true,
              filename: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return rooms.map((room) => this.formatRoomResponse(room));
    } catch (error) {
      logger.error("Get project rooms failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to get project rooms",
        500,
        "GET_PROJECT_ROOMS_ERROR"
      );
    }
  }

  /**
   * Update room image
   */
  async updateRoomImage(
    roomId: string,
    userId: string,
    imageUrl: string
  ): Promise<any> {
    try {
      // First check if room exists and user owns it
      const existingRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          project: {
            select: { userId: true },
          },
        },
      });

      if (!existingRoom) {
        throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
      }

      if (existingRoom.project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only update your own rooms.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Update room with new image URL
      const room = await this.prisma.room.update({
        where: { id: roomId },
        data: { originalImageUrl: imageUrl },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              type: true,
              style: true,
            },
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      logger.info("Room image updated successfully", {
        roomId,
        userId,
        imageUrl,
      });

      return this.formatRoomResponse(room);
    } catch (error) {
      logger.error("Room image update failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to update room image",
        500,
        "ROOM_IMAGE_UPDATE_ERROR"
      );
    }
  }

  /**
   * Get room statistics
   */
  async getRoomStats(userId: string): Promise<{
    totalRooms: number;
    roomsByType: Record<string, number>;
    roomsByProject: any[];
    averageRoomSize: number;
    totalDesigns: number;
    totalUploads: number;
  }> {
    try {
      // Get all user rooms through their projects
      const rooms = await this.prisma.room.findMany({
        where: {
          project: {
            userId,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              designs: true,
              uploads: true,
            },
          },
        },
      });

      // Calculate statistics
      const totalRooms = rooms.length;

      // Group by room type
      const roomsByType: Record<string, number> = {};
      rooms.forEach((room) => {
        roomsByType[room.type] = (roomsByType[room.type] || 0) + 1;
      });

      // Group by project
      const projectRoomCounts: Record<string, { name: string; count: number }> =
        {};
      rooms.forEach((room) => {
        const projectId = room.project.id;
        if (!projectRoomCounts[projectId]) {
          projectRoomCounts[projectId] = {
            name: room.project.name,
            count: 0,
          };
        }
        projectRoomCounts[projectId].count++;
      });

      const roomsByProject = Object.entries(projectRoomCounts).map(
        ([id, data]) => ({
          projectId: id,
          projectName: data.name,
          roomCount: data.count,
        })
      );

      // Calculate average room size (length * width)
      const totalArea = rooms.reduce(
        (sum, room) => sum + room.length * room.width,
        0
      );
      const averageRoomSize =
        totalRooms > 0 ? Math.round((totalArea / totalRooms) * 100) / 100 : 0;

      // Count total designs and uploads
      const totalDesigns = rooms.reduce(
        (sum, room) => sum + room._count.designs,
        0
      );
      const totalUploads = rooms.reduce(
        (sum, room) => sum + room._count.uploads,
        0
      );

      return {
        totalRooms,
        roomsByType,
        roomsByProject,
        averageRoomSize,
        totalDesigns,
        totalUploads,
      };
    } catch (error) {
      logger.error("Get room stats failed:", error);
      throw new AppError(
        "Failed to get room statistics",
        500,
        "GET_ROOM_STATS_ERROR"
      );
    }
  }

  /**
   * Format room response
   */
  private formatRoomResponse(
    room: any,
    includeFullDetails: boolean = false
  ): any {
    const formatted = {
      id: room.id,
      projectId: room.projectId,
      name: room.name,
      type: room.type,
      length: room.length,
      width: room.width,
      height: room.height,
      materials: room.materials,
      ambientColor: room.ambientColor,
      freePrompt: room.freePrompt,
      originalImageUrl: room.originalImageUrl,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      designCount: room._count?.designs || room.designs?.length || 0,
      uploadCount: room._count?.uploads || room.uploads?.length || 0,
    };

    // Add project information if available
    if (room.project) {
      (formatted as any).project = {
        id: room.project.id,
        name: room.project.name,
        type: room.project.type,
        style: room.project.style,
      };
    }

    // Add design information
    if (room.designs && room.designs.length > 0) {
      (formatted as any).latestDesigns = room.designs.map((design: any) => ({
        id: design.id,
        imageUrl: design.imageUrl,
        status: design.status,
        createdAt: design.createdAt.toISOString(),
        ...(includeFullDetails && {
          prompt: design.prompt,
          aiProvider: design.aiProvider,
          processingTime: design.processingTime,
          metadata: design.metadata,
        }),
      }));
    }

    // Add upload information
    if (room.uploads && room.uploads.length > 0) {
      (formatted as any).latestUploads = room.uploads.map((upload: any) => ({
        id: upload.id,
        url: upload.url,
        filename: upload.filename,
        originalName: upload.originalName,
        size: upload.size,
        createdAt: upload.createdAt.toISOString(),
      }));
    }

    // Calculate room area
    (formatted as any).area = Math.round(room.length * room.width * 100) / 100;
    (formatted as any).volume =
      Math.round(room.length * room.width * room.height * 100) / 100;

    return formatted;
  }
}
