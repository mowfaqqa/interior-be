import bcrypt from "bcryptjs";
import { config } from "../config/env";
import logger from "./logger";

export class BcryptUtil {
  /**
   * Hash a password
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(config.auth.bcryptRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      return hashedPassword;
    } catch (error) {
      logger.error("Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hashedPassword);
      return isMatch;
    } catch (error) {
      logger.error("Error comparing password:", error);
      throw new Error("Failed to compare password");
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    // Maximum length
    if (password.length > 128) {
      errors.push("Password must not exceed 128 characters");
    }

    // Must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    // Must contain at least one digit
    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    // Must contain at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    // Check for common weak patterns
    const commonPatterns = [
      /(.)\1{2,}/, // Three or more consecutive identical characters
      /123456|abcdef|qwerty|password|admin/i, // Common sequences
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        errors.push("Password contains common patterns and is too weak");
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    const allChars = lowercase + uppercase + numbers + special;

    let password = "";

    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to avoid predictable patterns
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  /**
   * Check if password needs rehashing (useful for changing bcrypt rounds)
   */
  static needsRehash(hashedPassword: string): boolean {
    try {
      const rounds = bcrypt.getRounds(hashedPassword);
      return rounds < config.auth.bcryptRounds;
    } catch (error) {
      // If we can't determine rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Safely time password comparison to prevent timing attacks
   */
  static async safeComparePassword(
    password: string,
    hashedPassword: string | null
  ): Promise<boolean> {
    // Always perform a hash operation to prevent timing attacks
    // even when hashedPassword is null
    const dummyHash =
      "$2a$12$dummy.hash.to.prevent.timing.attacks.abcdefghijklmnopqrstuv";
    const targetHash = hashedPassword || dummyHash;

    try {
      const isMatch = await bcrypt.compare(password, targetHash);
      // Only return true if we have a real hash and it matches
      return hashedPassword !== null && isMatch;
    } catch (error) {
      // Always return false on error, but still log it
      logger.error("Error in safe password comparison:", error);
      return false;
    }
  }
}
