// src/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserType } from './entities/auth.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { StaffAttendance } from '../staff/entities/staff-attendance.entity';
import { EmailService } from '../email/email.service';

// In-memory storage for password reset codes with expiration
const passwordResetCodes: Map<string, { code: string; expiresAt: Date }> = new Map();
// Track which users have verified their email for password reset
const passwordVerifiedUsers: Set<string> = new Set();

// In-memory storage for forgot password codes (email-based)
const forgotPasswordCodes: Map<string, { code: string; expiresAt: Date }> = new Map();
// Track which emails have verified their code for forgot password
const forgotPasswordVerifiedEmails: Set<string> = new Set();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(StaffAttendance)
    private attendanceRepository: Repository<StaffAttendance>,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private formatPhilippinePhone(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith('63')) {
      cleaned = cleaned.substring(2);
    }
    
    const mobileRegex = /^9\d{9}$/;
    if (!mobileRegex.test(cleaned)) {
      throw new BadRequestException('Invalid Philippine phone number. Must be a 10-digit number starting with 9 (e.g., 9123456789)');
    }
    
    return `+63${cleaned}`;
  }

  async register(registerDto: RegisterDto) {
    try {
      // Format phone number
      const formattedPhoneNumber = this.formatPhilippinePhone(registerDto.phoneNumber);

      // Check if user exists
      const existingUser = await this.userRepository.findOne({
        where: [
          { email: registerDto.email },
          { phoneNumber: formattedPhoneNumber }
        ]
      });

      if (existingUser) {
        throw new ConflictException('User with this email or phone already exists');
      }

      // Create new user instance
      const user = new User();
      user.name = registerDto.name;
      user.email = registerDto.email;
      user.phoneNumber = formattedPhoneNumber;
      const resolvedBusinessName = registerDto.businessName?.trim() || null;

      if (registerDto.userType !== UserType.CLIENT && !resolvedBusinessName) {
        throw new BadRequestException('Business name is required for admin and staff users');
      }

      user.businessName = resolvedBusinessName;
      user.userType = registerDto.userType;
      // Let the entity lifecycle hook hash the password to avoid double-hashing
      user.password = registerDto.password;
      user.profilePic = registerDto.profilePic ?? null;

      // Save user
      const savedUser = await this.userRepository.save(user);

      // Return response without password
      return {
        success: true,
        message: 'User registered successfully',
        data: {
          id: savedUser.id,
          email: savedUser.email,
          phoneNumber: savedUser.phoneNumber,
          businessName: savedUser.businessName,
          name: savedUser.name,
          userType: savedUser.userType,
          profilePic: savedUser.profilePic,
          status: savedUser.status,
          createdAt: savedUser.createdAt,
          updatedAt: savedUser.updatedAt
        }
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Registration failed');
    }
  }

  async getAvailableBusinessNames() {
    const rows = await this.userRepository
      .createQueryBuilder('user')
      .select('user.businessName', 'businessName')
      .where('user.businessName IS NOT NULL')
      .andWhere("TRIM(user.businessName) != ''")
      .andWhere('user.userType IN (:...types)', { types: [UserType.ADMIN, UserType.STAFF] })
      .groupBy('user.businessName')
      .orderBy('user.businessName', 'ASC')
      .getRawMany();

    return {
      success: true,
      data: rows.map((row) => row.businessName),
    };
  }

  async login(loginDto: LoginDto) {
    const logger = new Logger('AuthService');
    // Support login by email or phone number
    let user: User | null = null;

    try {
      if (loginDto.email) {
        logger.debug(`Login attempt for email=${loginDto.email}`);
        // Ensure password column is selected (in case it's excluded by default)
        user = await this.userRepository.createQueryBuilder('user')
          .addSelect('user.password')
          .where('user.email = :email', { email: loginDto.email })
          .getOne();
      } else if (loginDto.phoneNumber) {
        // Normalize Philippine phone numbers
        const formatted = this.formatPhilippinePhone(loginDto.phoneNumber);
        logger.debug(`Login attempt for phone=${formatted}`);
        user = await this.userRepository.createQueryBuilder('user')
          .addSelect('user.password')
          .where('user.phoneNumber = :phone', { phone: formatted })
          .getOne();
      } else {
        throw new BadRequestException('Email or phone number is required');
      }

      if (!user) {
        logger.warn('User not found for provided credentials');
        throw new UnauthorizedException('Invalid email/phone or password');
      }

      if (!user.password) {
        logger.error(`User ${user.id} has no password stored`);
        throw new BadRequestException('Server error: password not stored for user');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

      if (!isPasswordValid) {
        logger.warn(`Invalid password attempt for user ${user.id}`);
        throw new UnauthorizedException('Invalid email/phone or password');
      }

      // Set user status to active on successful login
      if (user.status !== 'active') {
        user.status = 'active';
        await this.userRepository.save(user);
        logger.log(`✅ User ${user.id} status set to active`);
      }

      // Generate JWT token
      const payload = {
        sub: user.id,
        email: user.email,
        userType: user.userType,
        name: user.name,
      };

      const token = this.jwtService.sign(payload);
      
      logger.log(`✅ Login successful for ${user.email}`);
      logger.log(`🔐 Generated token (first 30 chars): ${token.substring(0, 30)}...`);
      logger.log(`📦 Token payload: ${JSON.stringify(payload)}`);

      // Return response without password
      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
            businessName: user.businessName,
            name: user.name,
            userType: user.userType,
            profilePic: user.profilePic,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          token,
        },
      };
    } catch (error) {
      // Re-throw known HTTP exceptions
      if (error.status && (error.status === 400 || error.status === 401)) throw error;
      logger.error('Login failed unexpectedly', error as any);
      throw new BadRequestException('Login failed');
    }
  }

  async checkInOnLogin(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await this.attendanceRepository.findOne({
      where: {
        userId,
        date: Between(todayStart, todayEnd),
      },
      order: { createdAt: 'DESC' },
    });

    if (existing && existing.checkIn && !existing.checkOut) {
      return;
    }

    const attendance = new StaffAttendance();
    attendance.userId = userId;
    attendance.date = now;
    attendance.checkIn = now.toTimeString().slice(0, 8);
    attendance.status = 'present';
    await this.attendanceRepository.save(attendance);
  }

  async checkOutOnLogout(userId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await this.attendanceRepository.findOne({
      where: {
        userId,
        date: Between(todayStart, todayEnd),
      },
      order: { createdAt: 'DESC' },
    });

    if (existing && existing.checkIn && !existing.checkOut) {
      existing.checkOut = now.toTimeString().slice(0, 8);
      await this.attendanceRepository.save(existing);
    }

    return { success: true, message: 'Logged out successfully' };
  }

  async verifyPassword(userId: string, password: string) {
    const user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      success: true,
      message: 'Password verified',
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        businessName: user.businessName,
        name: user.name,
        userType: user.userType,
        profilePic: user.profilePic,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If changing password, verify email verification was completed first
    if (dto.newPassword) {
      if (!passwordVerifiedUsers.has(userId)) {
        throw new BadRequestException('Please verify your email before changing your password');
      }
      
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to set a new password');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.password);
      if (!ok) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      user.password = dto.newPassword; // entity hook will hash it
      
      // Remove the user from verified set after password change
      passwordVerifiedUsers.delete(userId);
    }

    if (dto.name) user.name = dto.name;
    if (dto.businessName) user.businessName = dto.businessName;
    if (dto.profilePic !== undefined) user.profilePic = dto.profilePic;

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user.email = dto.email;
    }

    const saved = await this.userRepository.save(user);

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: saved.id,
        email: saved.email,
        phoneNumber: saved.phoneNumber,
        businessName: saved.businessName,
        name: saved.name,
        userType: saved.userType,
        profilePic: saved.profilePic,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      },
    };
  }

  // Generate and send password reset code to email
  private generateResetCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  async sendPasswordResetCode(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const code = this.generateResetCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Code expires in 10 minutes

    // Store the code for verification
    passwordResetCodes.set(userId, { code, expiresAt });

    // Send email with verification code
    try {
      await this.emailService.sendPasswordResetCode(user.email, code);
    } catch (error) {
      // Clean up the stored code if email sending fails
      passwordResetCodes.delete(userId);
      throw error;
    }

    return {
      success: true,
      message: `Verification code sent to ${user.email}. Code expires in 10 minutes.`,
    };
  }

  async verifyPasswordResetCode(userId: string, code: string) {
    const stored = passwordResetCodes.get(userId);

    if (!stored) {
      throw new BadRequestException('No verification code sent. Please request a new one.');
    }

    if (new Date() > stored.expiresAt) {
      passwordResetCodes.delete(userId);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (stored.code !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    // Code verified successfully - mark this user as verified for password change
    passwordVerifiedUsers.add(userId);

    // Clean up the code
    passwordResetCodes.delete(userId);

    return {
      success: true,
      message: 'Email verified successfully. You can now change your password.',
    };
  }

  async resetAuthenticatedUserPassword(userId: string, newPassword: string) {
    const logger = new Logger('AuthService');

    // Check if user has verified their code
    if (!passwordVerifiedUsers.has(userId)) {
      throw new BadRequestException('Please verify your email first using the verification code.');
    }

    // Find user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    try {
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await this.userRepository.save(user);

      // Clean up verification
      passwordVerifiedUsers.delete(userId);

      logger.log(`✅ Password changed successfully for user ${userId}`);

      return {
        success: true,
        message: 'Password has been changed successfully.',
      };
    } catch (error) {
      logger.error(`❌ Error changing password for user ${userId}:`, error instanceof Error ? error.message : error);
      throw new BadRequestException('Failed to change password. Please try again.');
    }
  }

  // ===== FORGOT PASSWORD (NO LOGIN REQUIRED) =====

  async sendForgotPasswordCode(email: string) {
    const logger = new Logger('AuthService');
    
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      logger.warn(`Forgot password attempt for non-existent email: ${email}`);
      throw new BadRequestException('If an account exists with this email, a verification code will be sent.');
    }

    const code = this.generateResetCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Code expires in 10 minutes

    // Store the code with email as key
    forgotPasswordCodes.set(email, { code, expiresAt });

    // Send email with verification code
    try {
      await this.emailService.sendPasswordResetCode(email, code);
      logger.log(`✅ Forgot password code sent to ${email}`);
    } catch (error) {
      // Clean up the stored code if email sending fails
      forgotPasswordCodes.delete(email);
      logger.error(`❌ Failed to send forgot password code to ${email}:`, error instanceof Error ? error.message : error);
      throw error;
    }

    return {
      success: true,
      message: `Verification code sent to ${email}. Code expires in 10 minutes.`,
    };
  }

  async verifyForgotPasswordCode(email: string, code: string) {
    const stored = forgotPasswordCodes.get(email);

    if (!stored) {
      throw new BadRequestException('No verification code found. Please request a new one.');
    }

    if (new Date() > stored.expiresAt) {
      forgotPasswordCodes.delete(email);
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (stored.code !== code) {
      throw new BadRequestException('Invalid verification code.');
    }

    // Code verified successfully
    forgotPasswordVerifiedEmails.add(email);

    // Clean up the code
    forgotPasswordCodes.delete(email);

    return {
      success: true,
      message: 'Email verified successfully. You can now reset your password.',
    };
  }

  async resetForgotPassword(email: string, code: string, newPassword: string) {
    const logger = new Logger('AuthService');

    // Check if email has verified their code
    if (!forgotPasswordVerifiedEmails.has(email)) {
      throw new BadRequestException('Please verify your email first using the verification code.');
    }

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }

    try {
      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await this.userRepository.save(user);

      // Clean up verification
      forgotPasswordVerifiedEmails.delete(email);

      logger.log(`✅ Password reset successfully for ${email}`);

      return {
        success: true,
        message: 'Password has been reset successfully. You can now log in with your new password.',
      };
    } catch (error) {
      logger.error(`❌ Error resetting password for ${email}:`, error instanceof Error ? error.message : error);
      throw new BadRequestException('Failed to reset password. Please try again.');
    }
  }
}