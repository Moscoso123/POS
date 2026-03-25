// src/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './entities/auth.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
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
      user.businessName = registerDto.businessName;
      user.userType = registerDto.userType;
      // Let the entity lifecycle hook hash the password to avoid double-hashing
      user.password = registerDto.password;
      user.profilePic = null;

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

      // Generate JWT token
      const payload = {
        sub: user.id,
        email: user.email,
        userType: user.userType,
        name: user.name,
      };

      const token = this.jwtService.sign(payload);

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
}