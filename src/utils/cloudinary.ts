import { v2 as cloudinary } from "cloudinary";
import { config } from "../config/env";
import logger from "./logger";
import { CloudinaryResponse } from "../types";

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.upload.cloudinary.cloudName,
  api_key: config.upload.cloudinary.apiKey,
  api_secret: config.upload.cloudinary.apiSecret,
  secure: true,
});

export class CloudinaryUtil {
  /**
   * Upload image to Cloudinary
   */
  static async uploadImage(
    buffer: Buffer,
    options: {
      folder?: string;
      public_id?: string;
      transformation?: any;
      resource_type?: "image" | "video" | "raw" | "auto";
    } = {}
  ): Promise<CloudinaryResponse> {
    try {
      const defaultOptions = {
        folder: "interior-design/uploads",
        resource_type: "image" as const,
        quality: "auto",
        fetch_format: "auto",
        ...options,
      };

      const result = await new Promise<CloudinaryResponse>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(defaultOptions, (error, result) => {
              if (error) {
                reject(error);
              } else if (result) {
                resolve(result as CloudinaryResponse);
              } else {
                reject(new Error("Upload failed: No result returned"));
              }
            })
            .end(buffer);
        }
      );

      logger.info("Image uploaded successfully to Cloudinary", {
        public_id: result.public_id,
        bytes: result.bytes,
        format: result.format,
      });

      return result;
    } catch (error) {
      logger.error("Error uploading image to Cloudinary:", error);
      throw new Error("Failed to upload image");
    }
  }

  /**
   * Upload image from URL
   */
  static async uploadFromUrl(
    url: string,
    options: {
      folder?: string;
      public_id?: string;
      transformation?: any;
    } = {}
  ): Promise<CloudinaryResponse> {
    try {
      const defaultOptions = {
        folder: "interior-design/uploads",
        quality: "auto",
        fetch_format: "auto",
        ...options,
      };

      const result = await cloudinary.uploader.upload(url, defaultOptions);

      logger.info("Image uploaded from URL to Cloudinary", {
        public_id: result.public_id,
        original_url: url,
      });

      return result as CloudinaryResponse;
    } catch (error) {
      logger.error("Error uploading image from URL to Cloudinary:", error);
      throw new Error("Failed to upload image from URL");
    }
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result === "ok") {
        logger.info("Image deleted successfully from Cloudinary", {
          public_id: publicId,
        });
      } else {
        logger.warn("Image deletion result:", { public_id: publicId, result });
      }
    } catch (error) {
      logger.error("Error deleting image from Cloudinary:", error);
      throw new Error("Failed to delete image");
    }
  }

  /**
   * Generate optimized image URL with transformations
   */
  static generateOptimizedUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string | number;
      format?: string;
    } = {}
  ): string {
    try {
      const url = cloudinary.url(publicId, {
        quality: "auto",
        fetch_format: "auto",
        ...options,
      });

      return url;
    } catch (error) {
      logger.error("Error generating optimized URL:", error);
      throw new Error("Failed to generate optimized URL");
    }
  }

  /**
   * Generate thumbnail URL
   */
  static generateThumbnailUrl(publicId: string, size: number = 200): string {
    return this.generateOptimizedUrl(publicId, {
      width: size,
      height: size,
      crop: "fill",
      quality: "auto",
    });
  }

  /**
   * Generate responsive image URLs
   */
  static generateResponsiveUrls(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    original: string;
  } {
    return {
      thumbnail: this.generateOptimizedUrl(publicId, {
        width: 200,
        height: 200,
        crop: "fill",
      }),
      small: this.generateOptimizedUrl(publicId, { width: 400, crop: "scale" }),
      medium: this.generateOptimizedUrl(publicId, {
        width: 800,
        crop: "scale",
      }),
      large: this.generateOptimizedUrl(publicId, {
        width: 1200,
        crop: "scale",
      }),
      original: this.generateOptimizedUrl(publicId),
    };
  }

  /**
   * Check if image exists in Cloudinary
   */
  static async imageExists(publicId: string): Promise<boolean> {
    try {
      await cloudinary.api.resource(publicId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get image metadata
   */
  static async getImageMetadata(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        image_metadata: true,
        colors: true,
        faces: true,
      });

      return {
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        colors: result.colors,
        faces: result.faces,
        metadata: result.image_metadata,
      };
    } catch (error) {
      logger.error("Error getting image metadata:", error);
      throw new Error("Failed to get image metadata");
    }
  }

  /**
   * Batch delete images
   */
  static async deleteImages(publicIds: string[]): Promise<void> {
    try {
      if (publicIds.length === 0) return;

      const result = await cloudinary.api.delete_resources(publicIds);

      logger.info("Batch delete completed", {
        deleted: Object.keys(result.deleted).length,
        failed: Object.keys(result.deleted_counts || {}).length,
      });
    } catch (error) {
      logger.error("Error batch deleting images:", error);
      throw new Error("Failed to delete images");
    }
  }

  /**
   * Create signed upload URL for direct client uploads
   */
  static generateSignedUploadUrl(
    options: {
      folder?: string;
      timestamp?: number;
      eager?: string;
      public_id?: string;
    } = {}
  ): { url: string; signature: string; timestamp: number } {
    try {
      const timestamp = options.timestamp || Math.round(Date.now() / 1000);

      const params = {
        timestamp,
        folder: options.folder || "interior-design/uploads",
        ...options,
      };

      const signature = cloudinary.utils.api_sign_request(
        params,
        config.upload.cloudinary.apiSecret
      );

      return {
        url: `https://api.cloudinary.com/v1_1/${config.upload.cloudinary.cloudName}/image/upload`,
        signature,
        timestamp,
      };
    } catch (error) {
      logger.error("Error generating signed upload URL:", error);
      throw new Error("Failed to generate signed upload URL");
    }
  }

  /**
   * Transform image for AI processing
   */
  static generateAIProcessingUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
    } = {}
  ): string {
    const defaultOptions = {
      width: 1024,
      height: 1024,
      crop: "fill",
      quality: 85,
      format: "jpg",
      ...options,
    };

    return this.generateOptimizedUrl(publicId, defaultOptions);
  }

  /**
   * Health check for Cloudinary connection
   */
  static async healthCheck(): Promise<boolean> {
    try {
      await cloudinary.api.ping();
      return true;
    } catch (error) {
      logger.error("Cloudinary health check failed:", error);
      return false;
    }
  }
}
