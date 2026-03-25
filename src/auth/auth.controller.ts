import { Controller, Post, Body, UseInterceptors, UploadedFile, HttpCode, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(FileInterceptor('profilePic', {
    storage: diskStorage({
      destination: './uploads/profiles', // Folder where images will be stored
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        callback(null, `${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, callback) => {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        return callback(new Error('Only image files are allowed!'), false);
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
    return this.authService.login(loginDto);
  }
}