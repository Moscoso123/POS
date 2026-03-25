import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffAttendance } from './entities/staff-attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StaffAttendance])],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}