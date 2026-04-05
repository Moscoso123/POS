import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMessage } from './entities/chat.entity';
import { AiLearningEntry } from './entities/ai-learning.entity';
import { User } from '../auth/entities/auth.entity';
import { Sale } from '../sales/entities/sales.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Product } from '../products/entities/products.entity';
import { StaffAttendance } from '../staff/entities/staff-attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage, User, AiLearningEntry, Sale, SaleItem, Product, StaffAttendance])],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
