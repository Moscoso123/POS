import { Controller, Post, Get, Param, Body, UseGuards, Request, HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/auth.entity';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Post('send')
  async sendMessage(
    @Request() req,
    @Body() body: { receiverId: string; message: string },
  ) {
    try {
      console.log('💬 Chat Controller - sendMessage:', {
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.name,
        receiverId: body.receiverId,
        message: body.message,
      });

      // Get user ID from JWT - may be in id field or need to look up by email
      let userId = req.user?.id;
      
      if (!userId && req.user?.email) {
        console.log('💬 User ID not in token, looking up by email:', req.user.email);
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
        console.log('💬 Found user ID by email:', userId);
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      if (!body.receiverId) {
        throw new HttpException('Receiver ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!body.message || body.message.trim().length === 0) {
        throw new HttpException('Message cannot be empty', HttpStatus.BAD_REQUEST);
      }

      const result = await this.chatService.sendMessage(
        userId,
        body.receiverId,
        body.message,
      );
      return result;
    } catch (error) {
      console.error('💬 Chat Controller Error:', {
        message: error?.message,
        stack: error?.stack,
        statusCode: error?.status,
      });
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error?.message || 'Failed to send message',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('conversation/:otherUserId')
  async getConversation(@Request() req, @Param('otherUserId') otherUserId: string) {
    try {
      let userId = req.user?.id;
      
      if (!userId && req.user?.email) {
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const messages = await this.chatService.getConversation(userId, otherUserId);
      return { success: true, data: messages };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('contacts')
  async getContacts(@Request() req) {
    try {
      let userId = req.user?.id;
      
      if (!userId && req.user?.email) {
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const contacts = await this.chatService.getContacts(userId);
      return { success: true, data: contacts };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    try {
      let userId = req.user?.id;
      
      if (!userId && req.user?.email) {
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const count = await this.chatService.getUnreadCount(userId);
      return { success: true, count };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('mark-as-read/:messageId')
  async markAsRead(@Param('messageId') messageId: string) {
    try {
      await this.chatService.markAsRead(messageId);
      return { success: true };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('assistant')
  async assistantGuide(
    @Request() req,
    @Body() body: {
      query?: string;
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ) {
    try {
      let userId = req.user?.id;

      if (!userId && req.user?.email) {
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const message = (body?.message || body?.query || '').trim();
      if (!message) {
        throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
      }

      if (message.length > 2000) {
        throw new HttpException('Message is too long', HttpStatus.BAD_REQUEST);
      }

      const result = await this.chatService.getAssistantChatReply(
        userId,
        message,
        body?.history || [],
        req.user?.userType,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error?.message || 'Failed to get assistant guidance',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('assistant/feedback')
  async assistantFeedback(
    @Request() req,
    @Body() body: { prompt: string; correction?: string; feedbackScore?: number },
  ) {
    try {
      let userId = req.user?.id;

      if (!userId && req.user?.email) {
        const user = await this.userRepository.findOne({
          where: { email: req.user.email },
        });
        if (!user) {
          throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        }
        userId = user.id;
      }

      if (!userId) {
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      const result = await this.chatService.submitAssistantFeedback({
        userId,
        prompt: body?.prompt || '',
        correction: body?.correction,
        feedbackScore: body?.feedbackScore,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error?.message || 'Failed to save assistant feedback',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
