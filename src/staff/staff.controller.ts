import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { StaffService } from './staff.service';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('list')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getStaffList() {
    return this.staffService.getStaffList();
  }

  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles('admin')
  inviteStaff(@Request() req, @Body() inviteDto: InviteStaffDto) {
    return this.staffService.inviteStaff(req.user.userId, inviteDto);
  }

  @Post('update-status')
  async updateStatus(@Request() req, @Body() { status }: { status: 'active' | 'inactive' }) {
    return this.staffService.updateStatus(req.user.userId, status);
  }
}