import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Interior Design AI API",
      version: "1.0.0",
      description: "AI-powered interior design application API documentation",
      contact: {
        name: "API Support",
        email: "support@interiordesign.ai",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: config.isDevelopment
          ? `http://localhost:${config.port}/api/${config.server.apiVersion}`
          : `https://api.interiordesign.ai/api/${config.server.apiVersion}`,
        description: config.isDevelopment
          ? "Development server"
          : "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token in the format: Bearer <token>",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "clpv1234567890" },
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            name: { type: "string", example: "John Doe" },
            userType: {
              type: "string",
              enum: ["INDIVIDUAL", "BUSINESS"],
              example: "INDIVIDUAL",
            },
            organization: {
              type: "string",
              example: "Acme Corp",
              nullable: true,
            },
            isVerified: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string", example: "clpv1234567890" },
            name: { type: "string", example: "Modern Living Room" },
            description: {
              type: "string",
              example: "A contemporary living space",
              nullable: true,
            },
            type: {
              type: "string",
              enum: ["RESIDENTIAL", "OFFICE"],
              example: "RESIDENTIAL",
            },
            style: {
              type: "string",
              enum: [
                "ART_DECO",
                "BOHEMIAN",
                "COASTAL",
                "RUSTIC",
                "CONTEMPORARY",
                "ETHNIC",
                "INDUSTRIAL",
                "SCANDINAVIAN",
                "VINTAGE",
                "MINIMALIST",
              ],
              example: "SCANDINAVIAN",
            },
            isActive: { type: "boolean", example: true },
            userId: { type: "string", example: "clpv1234567890" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Room: {
          type: "object",
          properties: {
            id: { type: "string", example: "clpv1234567890" },
            projectId: { type: "string", example: "clpv1234567890" },
            name: { type: "string", example: "Master Bedroom", nullable: true },
            type: {
              type: "string",
              enum: [
                "LIVING_ROOM",
                "BEDROOM",
                "KITCHEN",
                "BATHROOM",
                "OFFICE",
                "DINING_ROOM",
                "BALCONY",
                "STUDY",
                "HALLWAY",
                "OTHER",
              ],
              example: "BEDROOM",
            },
            length: { type: "number", format: "float", example: 4.5 },
            width: { type: "number", format: "float", example: 3.2 },
            height: { type: "number", format: "float", example: 2.7 },
            materials: {
              type: "array",
              items: { type: "string" },
              example: ["wood", "marble", "steel"],
            },
            ambientColor: {
              type: "string",
              example: "warm white",
              nullable: true,
            },
            freePrompt: {
              type: "string",
              example: "Add plants and natural lighting",
              nullable: true,
            },
            originalImageUrl: { type: "string", format: "uri", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Design: {
          type: "object",
          properties: {
            id: { type: "string", example: "clpv1234567890" },
            roomId: { type: "string", example: "clpv1234567890" },
            imageUrl: {
              type: "string",
              format: "uri",
              example: "https://res.cloudinary.com/...",
            },
            prompt: {
              type: "string",
              example: "Scandinavian bedroom with natural materials",
            },
            aiProvider: {
              type: "string",
              enum: ["openai", "replicate"],
              example: "replicate",
            },
            status: {
              type: "string",
              enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
              example: "COMPLETED",
            },
            metadata: { type: "object", nullable: true },
            processingTime: { type: "integer", example: 15000, nullable: true },
            error: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Upload: {
          type: "object",
          properties: {
            id: { type: "string", example: "clpv1234567890" },
            roomId: {
              type: "string",
              example: "clpv1234567890",
              nullable: true,
            },
            filename: { type: "string", example: "room_image_123.jpg" },
            originalName: { type: "string", example: "my_room.jpg" },
            mimeType: { type: "string", example: "image/jpeg" },
            size: { type: "integer", example: 2048576 },
            url: {
              type: "string",
              format: "uri",
              example: "https://res.cloudinary.com/...",
            },
            cloudinaryId: {
              type: "string",
              example: "room_images/abc123",
              nullable: true,
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
            error: { type: "string", nullable: true },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            field: { type: "string", example: "email" },
            message: { type: "string", example: "Email is required" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Data retrieved successfully" },
            data: {
              type: "array",
              items: { type: "object" },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer", example: 1 },
                limit: { type: "integer", example: 10 },
                total: { type: "integer", example: 100 },
                totalPages: { type: "integer", example: 10 },
              },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "An error occurred" },
            error: { type: "string", example: "Detailed error message" },
            errors: {
              type: "array",
              items: { $ref: "#/components/schemas/ValidationError" },
              nullable: true,
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization endpoints",
      },
      {
        name: "Users",
        description: "User management endpoints",
      },
      {
        name: "Projects",
        description: "Project management endpoints",
      },
      {
        name: "Rooms",
        description: "Room management endpoints",
      },
      {
        name: "Designs",
        description: "AI design generation endpoints",
      },
      {
        name: "Uploads",
        description: "File upload endpoints",
      },
      {
        name: "Health",
        description: "Health check endpoints",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

export const specs = swaggerJsdoc(options);
