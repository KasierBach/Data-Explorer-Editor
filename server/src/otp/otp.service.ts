import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Generates a random 6-digit numeric OTP.
   */
  generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hashes an OTP for secure storage.
   */
  async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, this.SALT_ROUNDS);
  }

  /**
   * Verifies a raw OTP against a hashed version.
   */
  async verifyOtp(otp: string, hashedOtp: string): Promise<boolean> {
    return bcrypt.compare(otp, hashedOtp);
  }

  /**
   * Calculates expiry date for an OTP.
   * @param minutes - Number of minutes from now.
   */
  getExpiryDate(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  /**
   * Checks if an OTP has expired.
   */
  isExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }
}
