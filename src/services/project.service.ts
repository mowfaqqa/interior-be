import { PrismaClient } from "@prisma/client";
import { CreateProjectDto, UpdateProjectDto, ProjectQuery } from "../types";
import { AppError } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class ProjectService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new project
   */
  async createProject(
    userId: string,
    projectData: CreateProjectDto
  ): Promise<any> {
    try {
      const project = await this.prisma.project.create({
        data: {
          ...projectData,
          userId,
        },
        include: {
          rooms: {
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
      });

      logger.info("Project created successfully", {
        projectId: project.id,
        userId,
        name: project.name,
      });

      return this.formatProjectResponse(project);
    } catch (error) {
      logger.error("Project creation failed:", error);
      throw new AppError(
        "Failed to create project",
        500,
        "PROJECT_CREATION_ERROR"
      );
    }
  }

  /**
   * Get projects for a user with pagination and filters
   */
  async getUserProjects(
    userId: string,
    query: ProjectQuery
  ): Promise<{
    projects: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        style,
        isActive = true,
        search,
      } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause: any = {
        userId,
        isActive,
      };

      if (type) {
        whereClause.type = type;
      }

      if (style) {
        whereClause.style = style;
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      // Get total count
      const total = await this.prisma.project.count({
        where: whereClause,
      });

      // Get projects
      const projects = await this.prisma.project.findMany({
        where: whereClause,
        include: {
          rooms: {
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        projects: projects.map((project) =>
          this.formatProjectResponse(project)
        ),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get user projects failed:", error);
      throw new AppError("Failed to get projects", 500, "GET_PROJECTS_ERROR");
    }
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string, userId: string): Promise<any> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          rooms: {
            include: {
              designs: {
                select: {
                  id: true,
                  imageUrl: true,
                  status: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 3, // Latest 3 designs per room
              },
              uploads: {
                select: {
                  id: true,
                  url: true,
                  filename: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1, // Latest upload per room
              },
              _count: {
                select: {
                  designs: true,
                  uploads: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
      });

      if (!project) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      // Check ownership
      if (project.userId !== userId) {
        throw new AppError(
          "Access denied. You can only view your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      return this.formatProjectResponse(project, true);
    } catch (error) {
      logger.error("Get project by ID failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to get project", 500, "GET_PROJECT_ERROR");
    }
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    userId: string,
    updateData: UpdateProjectDto
  ): Promise<any> {
    try {
      // First check if project exists and user owns it
      const existingProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      });

      if (!existingProject) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      if (existingProject.userId !== userId) {
        throw new AppError(
          "Access denied. You can only update your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Update project
      const project = await this.prisma.project.update({
        where: { id: projectId },
        data: updateData,
        include: {
          rooms: {
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
      });

      logger.info("Project updated successfully", {
        projectId,
        userId,
        updatedFields: Object.keys(updateData),
      });

      return this.formatProjectResponse(project);
    } catch (error) {
      logger.error("Project update failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to update project",
        500,
        "PROJECT_UPDATE_ERROR"
      );
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      // First check if project exists and user owns it
      const existingProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          userId: true,
          name: true,
          _count: {
            select: {
              rooms: true,
            },
          },
        },
      });

      if (!existingProject) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      if (existingProject.userId !== userId) {
        throw new AppError(
          "Access denied. You can only delete your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Delete project (cascade delete will handle rooms, designs, uploads)
      await this.prisma.project.delete({
        where: { id: projectId },
      });

      logger.info("Project deleted successfully", {
        projectId,
        userId,
        projectName: existingProject.name,
        roomsDeleted: existingProject._count.rooms,
      });
    } catch (error) {
      logger.error("Project deletion failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to delete project",
        500,
        "PROJECT_DELETE_ERROR"
      );
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(userId: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    projectsByType: Record<string, number>;
    projectsByStyle: Record<string, number>;
    totalRooms: number;
    totalDesigns: number;
    recentActivity: any[];
  }> {
    try {
      // Get basic project counts
      const [totalProjects, activeProjects] = await Promise.all([
        this.prisma.project.count({ where: { userId } }),
        this.prisma.project.count({ where: { userId, isActive: true } }),
      ]);

      // Get projects grouped by type and style
      const projects = await this.prisma.project.findMany({
        where: { userId },
        select: {
          type: true,
          style: true,
          rooms: {
            select: {
              id: true,
              designs: {
                select: { id: true },
              },
            },
          },
        },
      });

      // Calculate statistics
      const projectsByType: Record<string, number> = {};
      const projectsByStyle: Record<string, number> = {};
      let totalRooms = 0;
      let totalDesigns = 0;

      projects.forEach((project) => {
        // Count by type
        projectsByType[project.type] = (projectsByType[project.type] || 0) + 1;

        // Count by style
        projectsByStyle[project.style] =
          (projectsByStyle[project.style] || 0) + 1;

        // Count rooms and designs
        totalRooms += project.rooms.length;
        project.rooms.forEach((room) => {
          totalDesigns += room.designs.length;
        });
      });

      // Get recent activity (last 10 projects)
      const recentActivity = await this.prisma.project.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          style: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      return {
        totalProjects,
        activeProjects,
        projectsByType,
        projectsByStyle,
        totalRooms,
        totalDesigns,
        recentActivity: recentActivity.map((project) => ({
          ...project,
          updatedAt: project.updatedAt.toISOString(),
        })),
      };
    } catch (error) {
      logger.error("Get project stats failed:", error);
      throw new AppError(
        "Failed to get project statistics",
        500,
        "GET_PROJECT_STATS_ERROR"
      );
    }
  }

  /**
   * Duplicate project
   */
  async duplicateProject(
    projectId: string,
    userId: string,
    newName?: string
  ): Promise<any> {
    try {
      // Get original project with all rooms
      const originalProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          rooms: {
            include: {
              uploads: true,
            },
          },
        },
      });

      if (!originalProject) {
        throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
      }

      if (originalProject.userId !== userId) {
        throw new AppError(
          "Access denied. You can only duplicate your own projects.",
          403,
          "ACCESS_DENIED"
        );
      }

      // Create new project
      const duplicatedProject = await this.prisma.project.create({
        data: {
          name: newName || `${originalProject.name} (Copy)`,
          description: originalProject.description,
          type: originalProject.type,
          style: originalProject.style,
          userId,
          rooms: {
            create: originalProject.rooms.map((room) => ({
              name: room.name,
              type: room.type,
              length: room.length,
              width: room.width,
              height: room.height,
              materials: room.materials,
              ambientColor: room.ambientColor,
              freePrompt: room.freePrompt,
              originalImageUrl: room.originalImageUrl,
              // Note: Uploads are not duplicated for security reasons
            })),
          },
        },
        include: {
          rooms: {
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              rooms: true,
            },
          },
        },
      });

      logger.info("Project duplicated successfully", {
        originalProjectId: projectId,
        newProjectId: duplicatedProject.id,
        userId,
        roomsDuplicated: originalProject.rooms.length,
      });

      return this.formatProjectResponse(duplicatedProject);
    } catch (error) {
      logger.error("Project duplication failed:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "Failed to duplicate project",
        500,
        "PROJECT_DUPLICATE_ERROR"
      );
    }
  }

  /**
   * Format project response
   */
  private formatProjectResponse(
    project: any,
    includeRoomDetails: boolean = false
  ): any {
    const formatted = {
      id: project.id,
      name: project.name,
      description: project.description,
      type: project.type,
      style: project.style,
      isActive: project.isActive,
      userId: project.userId,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      roomCount: project._count?.rooms || project.rooms?.length || 0,
    };

    if (includeRoomDetails && project.rooms) {
      (formatted as any).rooms = project.rooms.map((room: any) => ({
        id: room.id,
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
        updatedAt: room.updatedAt?.toISOString(),
        designCount: room._count?.designs || room.designs?.length || 0,
        uploadCount: room._count?.uploads || room.uploads?.length || 0,
        ...(room.designs && {
          latestDesigns: room.designs.map((design: any) => ({
            id: design.id,
            imageUrl: design.imageUrl,
            status: design.status,
            createdAt: design.createdAt.toISOString(),
          })),
        }),
        ...(room.uploads &&
          room.uploads.length > 0 && {
            latestUpload: {
              id: room.uploads[0].id,
              url: room.uploads[0].url,
              filename: room.uploads[0].filename,
              createdAt: room.uploads[0].createdAt.toISOString(),
            },
          }),
      }));
    } else if (project.rooms) {
      (formatted as any).rooms = project.rooms.map((room: any) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt.toISOString(),
      }));
    }

    return formatted;
  }
}
