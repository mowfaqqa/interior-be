import { Request } from "express";
import { User, UserType } from "@prisma/client";

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  req: any;
  res: any;
  user?: User;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

// Auth Types
export interface JwtPayload {
  userId: string;
  email: string;
  userType: UserType;
}

export interface LoginResponse {
  user: UserProfile;
  token: string;
  refreshToken: string;
  expiresIn: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  organization?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

// DTO Types
export interface RegisterDto {
  email: string;
  name: string;
  password: string;
  userType: UserType;
  organization?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UpdateUserDto {
  name?: string;
  organization?: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  type: ProjectType;
  style: InteriorStyle;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  type?: ProjectType;
  style?: InteriorStyle;
  isActive?: boolean;
}

export interface CreateRoomDto {
  projectId: string;
  name?: string;
  type: RoomType;
  length: number;
  width: number;
  height: number;
  materials: string[];
  ambientColor?: string;
  freePrompt?: string;
}

export interface UpdateRoomDto {
  name?: string;
  type?: RoomType;
  length?: number;
  width?: number;
  height?: number;
  materials?: string[];
  ambientColor?: string;
  freePrompt?: string;
}

export interface GenerateDesignDto {
  roomId: string;
  customPrompt?: string;
  aiProvider?: "openai" | "replicate";
}

export enum ProjectType {
  RESIDENTIAL = "RESIDENTIAL",
  OFFICE = "OFFICE",
}

export enum RoomType {
  LIVING_ROOM = "LIVING_ROOM",
  BEDROOM = "BEDROOM",
  KITCHEN = "KITCHEN",
  BATHROOM = "BATHROOM",
  OFFICE = "OFFICE",
  DINING_ROOM = "DINING_ROOM",
  BALCONY = "BALCONY",
  STUDY = "STUDY",
  HALLWAY = "HALLWAY",
  OTHER = "OTHER",
}

export enum InteriorStyle {
  ART_DECO = "ART_DECO",
  BOHEMIAN = "BOHEMIAN",
  COASTAL = "COASTAL",
  RUSTIC = "RUSTIC",
  CONTEMPORARY = "CONTEMPORARY",
  ETHNIC = "ETHNIC",
  INDUSTRIAL = "INDUSTRIAL",
  SCANDINAVIAN = "SCANDINAVIAN",
  VINTAGE = "VINTAGE",
  MINIMALIST = "MINIMALIST",
}

export enum DesignStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// AI Service Types
export interface AIPromptData {
  roomType: RoomType;
  style: InteriorStyle;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  materials: string[];
  ambientColor?: string;
  customPrompt?: string;
}

export interface AIGenerationResult {
  imageUrls: string[];
  prompt: string;
  metadata: {
    provider: string;
    model?: string;
    processingTime: number;
    parameters?: any;
  };
}

// File Upload Types
export interface UploadConfig {
  maxSize: number;
  allowedTypes: string[];
  folder: string;
}

export interface CloudinaryResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  url: string;
  secure_url: string;
  bytes: number;
}

// Query Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ProjectQuery extends PaginationQuery {
  type?: ProjectType;
  style?: InteriorStyle;
  isActive?: boolean;
  search?: string;
}

export interface RoomQuery extends PaginationQuery {
  projectId?: string;
  type?: RoomType;
}

export interface DesignQuery extends PaginationQuery {
  roomId?: string;
  status?: DesignStatus;
  aiProvider?: string;
}
