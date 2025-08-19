import { Response, NextFunction } from "express";
import {
  AuthenticatedRequest,
  ApiResponse,
  CreateProjectDto,
  UpdateProjectDto,
} from "../types";
import { ProjectService } from "../services/project.service";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

export class ProjectController {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService(prisma);
  }

  /**
   * @swagger
   * /projects:
   *   post:
   *     summary: Create a new project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - type
   *               - style
   *             properties:
   *               name:
   *                 type: string
   *                 example: Modern Living Room
   *               description:
   *                 type: string
   *                 example: A contemporary living space with clean lines
   *               type:
   *                 type: string
   *                 enum: [RESIDENTIAL, OFFICE]
   *                 example: RESIDENTIAL
   *               style:
   *                 type: string
   *                 enum: [ART_DECO, BOHEMIAN, COASTAL, RUSTIC, CONTEMPORARY, ETHNIC, INDUSTRIAL, SCANDINAVIAN, VINTAGE, MINIMALIST]
   *                 example: CONTEMPORARY
   *     responses:
   *       201:
   *         description: Project created successfully
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
   *                   example: Project created successfully
   *                 data:
   *                   $ref: '#/components/schemas/Project'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Authentication required
   */
  createProject = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const projectData: CreateProjectDto = req.body;
      const userId = req.user!.id;

      const project = await this.projectService.createProject(
        userId,
        projectData
      );

      logger.info("Project created successfully", {
        projectId: project.id,
        userId,
        name: project.name,
      });

      res.status(201).json({
        success: true,
        message: "Project created successfully",
        data: project,
      });
    }
  );

  /**
   * @swagger
   * /projects:
   *   get:
   *     summary: Get user projects
   *     tags: [Projects]
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
   *           default: 10
   *         description: Items per page
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [RESIDENTIAL, OFFICE]
   *         description: Filter by project type
   *       - in: query
   *         name: style
   *         schema:
   *           type: string
   *           enum: [ART_DECO, BOHEMIAN, COASTAL, RUSTIC, CONTEMPORARY, ETHNIC, INDUSTRIAL, SCANDINAVIAN, VINTAGE, MINIMALIST]
   *         description: Filter by interior style
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *           default: true
   *         description: Filter by active status
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search in project name and description
   *     responses:
   *       200:
   *         description: Projects retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedResponse'
   *       401:
   *         description: Authentication required
   */
  getProjects = asyncHandler(
    async (req: AuthenticatedRequest, res: any, next: NextFunction) => {
      const userId = req.user!.id;
      const query = req.query;

      const result = await this.projectService.getUserProjects(userId, query);

      res.status(200).json({
        success: true,
        message: "Projects retrieved successfully",
        data: result.projects,
        pagination: result.pagination,
      });
    }
  );

  /**
   * @swagger
   * /projects/{id}:
   *   get:
   *     summary: Get project by ID
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Project retrieved successfully
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
   *                   example: Project retrieved successfully
   *                 data:
   *                   $ref: '#/components/schemas/Project'
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  getProject = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      const project = await this.projectService.getProjectById(id, userId);

      res.status(200).json({
        success: true,
        message: "Project retrieved successfully",
        data: project,
      });
    }
  );

  /**
   * @swagger
   * /projects/{id}:
   *   put:
   *     summary: Update project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: Updated Project Name
   *               description:
   *                 type: string
   *                 example: Updated project description
   *               type:
   *                 type: string
   *                 enum: [RESIDENTIAL, OFFICE]
   *               style:
   *                 type: string
   *                 enum: [ART_DECO, BOHEMIAN, COASTAL, RUSTIC, CONTEMPORARY, ETHNIC, INDUSTRIAL, SCANDINAVIAN, VINTAGE, MINIMALIST]
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Project updated successfully
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
   *                   example: Project updated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Project'
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  updateProject = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const updateData: UpdateProjectDto = req.body;
      const userId = req.user!.id;

      const project = await this.projectService.updateProject(
        id,
        userId,
        updateData
      );

      logger.info("Project updated successfully", {
        projectId: id,
        userId,
        updatedFields: Object.keys(updateData),
      });

      res.status(200).json({
        success: true,
        message: "Project updated successfully",
        data: project,
      });
    }
  );

  /**
   * @swagger
   * /projects/{id}:
   *   delete:
   *     summary: Delete project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID
   *     responses:
   *       200:
   *         description: Project deleted successfully
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
   *                   example: Project deleted successfully
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  deleteProject = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.projectService.deleteProject(id, userId);

      logger.info("Project deleted successfully", {
        projectId: id,
        userId,
      });

      res.status(200).json({
        success: true,
        message: "Project deleted successfully",
      });
    }
  );

  /**
   * @swagger
   * /projects/stats:
   *   get:
   *     summary: Get project statistics
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Project statistics retrieved successfully
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
   *                     totalProjects:
   *                       type: integer
   *                       example: 15
   *                     activeProjects:
   *                       type: integer
   *                       example: 12
   *                     projectsByType:
   *                       type: object
   *                       example: { "RESIDENTIAL": 10, "OFFICE": 5 }
   *                     projectsByStyle:
   *                       type: object
   *                       example: { "CONTEMPORARY": 5, "SCANDINAVIAN": 3, "MINIMALIST": 7 }
   *                     totalRooms:
   *                       type: integer
   *                       example: 45
   *                     totalDesigns:
   *                       type: integer
   *                       example: 120
   *                     recentActivity:
   *                       type: array
   *                       items:
   *                         type: object
   *       401:
   *         description: Authentication required
   */
  getProjectStats = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const userId = req.user!.id;

      const stats = await this.projectService.getProjectStats(userId);

      res.status(200).json({
        success: true,
        message: "Project statistics retrieved successfully",
        data: stats,
      });
    }
  );

  /**
   * @swagger
   * /projects/{id}/duplicate:
   *   post:
   *     summary: Duplicate project
   *     tags: [Projects]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Project ID to duplicate
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: Duplicated Project Name
   *     responses:
   *       201:
   *         description: Project duplicated successfully
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
   *                   example: Project duplicated successfully
   *                 data:
   *                   $ref: '#/components/schemas/Project'
   *       404:
   *         description: Project not found
   *       403:
   *         description: Access denied
   *       401:
   *         description: Authentication required
   */
  duplicateProject = asyncHandler(
    async (
      req: AuthenticatedRequest,
      res: Response<ApiResponse>,
      next: NextFunction
    ) => {
      const { id } = req.params;
      const { name } = req.body;
      const userId = req.user!.id;

      const duplicatedProject = await this.projectService.duplicateProject(
        id,
        userId,
        name
      );

      logger.info("Project duplicated successfully", {
        originalProjectId: id,
        newProjectId: duplicatedProject.id,
        userId,
      });

      res.status(201).json({
        success: true,
        message: "Project duplicated successfully",
        data: duplicatedProject,
      });
    }
  );
}
