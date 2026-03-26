import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { StaffAttendance } from './entities/staff-attendance.entity';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { User, UserType } from '../auth/entities/auth.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffAttendance)
    private attendanceRepository: Repository<StaffAttendance>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      throw new BadRequestException('Invalid Philippine phone number. Use 9XXXXXXXXX format.');
    }

    return `+63${cleaned}`;
  }

  async getStaffList(): Promise<Partial<User>[]> {
    const staff = await this.userRepository.find({
      where: { userType: In([UserType.STAFF, UserType.ADMIN]) },
      order: { createdAt: 'DESC' },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const todayAttendance = await this.attendanceRepository.find({
      where: {
        date: Between(todayStart, todayEnd),
      },
      order: { createdAt: 'DESC' },
    });

    const attendanceByUser = new Map<string, StaffAttendance>();
    todayAttendance.forEach((attendance) => {
      if (!attendanceByUser.has(attendance.userId)) {
        attendanceByUser.set(attendance.userId, attendance);
      }
    });

    return staff.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneNumber: u.phoneNumber,
      businessName: u.businessName,
      userType: u.userType,
      createdAt: u.createdAt,
      status: attendanceByUser.get(u.id)?.checkIn && !attendanceByUser.get(u.id)?.checkOut ? 'active' : 'inactive',
      checkIn: attendanceByUser.get(u.id)?.checkIn || null,
      checkOut: attendanceByUser.get(u.id)?.checkOut || null,
    }));
  }

  async inviteStaff(adminUserId: string, inviteDto: InviteStaffDto): Promise<any> {
    const admin = await this.userRepository.findOne({ where: { id: adminUserId } });
    if (!admin || admin.userType !== UserType.ADMIN) {
      throw new BadRequestException('Only admin can invite staff');
    }

    const formattedPhone = this.formatPhilippinePhone(inviteDto.phoneNumber);

    const existing = await this.userRepository.findOne({
      where: [{ email: inviteDto.email }, { phoneNumber: formattedPhone }],
    });

    if (existing) {
      if (existing.userType === UserType.STAFF) {
        return {
          success: true,
          existing: true,
          message: 'Staff already exists',
          data: {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            phoneNumber: existing.phoneNumber,
            userType: existing.userType,
          },
        };
      }

      throw new BadRequestException('A non-staff account already exists with this email or phone number');
    }

    const tempPassword = `Temp${Math.floor(100000 + Math.random() * 900000)}!`;

    const user = this.userRepository.create({
      name: inviteDto.name,
      email: inviteDto.email,
      phoneNumber: formattedPhone,
      businessName: inviteDto.businessName || admin.businessName,
      userType: UserType.STAFF,
      password: tempPassword,
      profilePic: null,
    });

    const saved = await this.userRepository.save(user);

    return {
      success: true,
      existing: false,
      message: 'Staff invited successfully',
      data: {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        phoneNumber: saved.phoneNumber,
        userType: saved.userType,
        temporaryPassword: tempPassword,
      },
    };
  }
}