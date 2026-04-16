import { Controller, Post, Get, Patch, Body, UseInterceptors, UploadedFile, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const allowedImageMimeToExt: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const dangerousUploadPattern = /\.(exe|bat|cmd|com|scr|pif|js|jse|vbs|vbe|wsf|wsh|ps1|msi|dll|jar|hta|sh|php|asp|aspx|jsp|py|rb)(\.|$)/i;

type UploadValidationFile = {
  originalname: string;
  mimetype: string;
};

function sanitizeAndValidateImageUpload(file: UploadValidationFile): string {
  const originalName = (file.originalname || '').toLowerCase();

  if (originalName.includes('\0')) {
    throw new Error('Invalid filename');
  }

  if (dangerousUploadPattern.test(originalName)) {
    throw new Error('Unsafe file type detected');
  }

  const mappedExtension = allowedImageMimeToExt[file.mimetype?.toLowerCase() || ''];
  const incomingExtension = extname(originalName);

  if (!mappedExtension) {
    throw new Error('Invalid file MIME type');
  }

  if (incomingExtension !== mappedExtension && !(mappedExtension === '.jpg' && incomingExtension === '.jpeg')) {
    throw new Error('File extension does not match MIME type');
  }

  return mappedExtension;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('businesses')
  async getBusinesses() {
    return this.authService.getAvailableBusinessNames();
  }

  @Post('register')
  @UseInterceptors(FileInterceptor('profilePic', {
    storage: diskStorage({
      destination: './uploads/profiles',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = allowedImageMimeToExt[file.mimetype?.toLowerCase() || ''] || extname(file.originalname).toLowerCase();
        callback(null, `${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, callback) => {
      try {
        sanitizeAndValidateImageUpload(file);
      } catch (error) {
        return callback(error as Error, false);
      }
      callback(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    }
  }))
  async register(
    @UploadedFile() file: Express.Multer.File,
    @Body() registerDto: RegisterDto
  ) {
    // Add file path to DTO if file was uploaded
    if (file) {
      registerDto.profilePic = `/uploads/profiles/${file.filename}`;
    }
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    // Auto check-in for staff on login
    if (result?.data?.user?.id) {
      try {
        await this.authService.checkInOnLogin(result.data.user.id);
      } catch { /* non-blocking */ }
    }
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    return this.authService.checkOutOnLogout(req.user.userId);
  }

  @Post('verify-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPassword(@Request() req, @Body() dto: VerifyPasswordDto) {
    return this.authService.verifyPassword(req.user.userId, dto.password);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('profilePic', {
    storage: diskStorage({
      destination: './uploads/profiles',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = allowedImageMimeToExt[file.mimetype?.toLowerCase() || ''] || extname(file.originalname).toLowerCase();
        callback(null, `${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, callback) => {
      try {
        sanitizeAndValidateImageUpload(file);
      } catch (error) {
        return callback(error as Error, false);
      }
      callback(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
  }))
  async updateProfile(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProfileDto,
  ) {
    if (file) {
      dto.profilePic = `/uploads/profiles/${file.filename}`;
    }
    return this.authService.updateProfile(req.user.userId, dto);
  }

  @Post('password-reset/send-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendPasswordResetCode(@Request() req) {
    return this.authService.sendPasswordResetCode(req.user.userId);
  }

  @Post('password-reset/verify-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPasswordResetCode(@Request() req, @Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyPasswordResetCode(req.user.userId, dto.code);
  }

  @Post('password-reset/reset')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Request() req, @Body() dto: { newPassword: string }) {
    return this.authService.resetAuthenticatedUserPassword(req.user.userId, dto.newPassword);
  }

  @Post('forgot-password/send-code')
  @HttpCode(HttpStatus.OK)
  async sendForgotPasswordCode(@Body() dto: { email: string }) {
    return this.authService.sendForgotPasswordCode(dto.email);
  }

  @Post('forgot-password/verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyForgotPasswordCode(@Body() dto: { email: string; code: string }) {
    return this.authService.verifyForgotPasswordCode(dto.email, dto.code);
  }

  @Post('forgot-password/reset')
  @HttpCode(HttpStatus.OK)
  async resetForgotPassword(@Body() dto: { email: string; code: string; newPassword: string }) {
    return this.authService.resetForgotPassword(dto.email, dto.code, dto.newPassword);
  }
}