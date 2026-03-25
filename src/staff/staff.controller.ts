import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('check-in')
  checkIn(@Request() req, @Body() createDto: CreateAttendanceDto) {
    return this.staffService.checkIn(req.user.userId, createDto);
  }

  @Post('check-out')
  checkOut(@Request() req, @Body() updateDto: UpdateAttendanceDto) {
    return this.staffService.checkOut(req.user.userId, updateDto);
  }

  @Get('attendance')
  getAttendance(
    @Request() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.staffService.getAttendance(req.user.userId, start, end);
  }

  @Get('attendance/all')
  getAllAttendance(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.staffService.getAllStaffAttendance(start, end);
  }
}