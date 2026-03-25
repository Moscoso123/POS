import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffAttendance } from './entities/staff-attendance.entity';
import { User } from '../auth/entities/auth.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StaffAttendance, User])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}