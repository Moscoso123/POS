import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StaffAttendance } from './entities/staff-attendance.entity';
import { CreateAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffAttendance)
    private attendanceRepository: Repository<StaffAttendance>,
  ) {}

  async checkIn(userId: string, createDto: CreateAttendanceDto): Promise<StaffAttendance> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await this.attendanceRepository.findOne({
      where: {
        userId,
        date: today,
      },
    });

    if (attendance && attendance.checkIn) {
      throw new BadRequestException('Already checked in today');
    }

    if (!attendance) {
      attendance = this.attendanceRepository.create({
        userId,
        date: today,
        checkIn: createDto.checkIn || new Date().toLocaleTimeString(),
        status: createDto.status || 'present',
        notes: createDto.notes,
      });
    } else {
      attendance.checkIn = createDto.checkIn || new Date().toLocaleTimeString();
      attendance.status = createDto.status || 'present';
      if (createDto.notes) attendance.notes = createDto.notes;
    }

    return this.attendanceRepository.save(attendance);
  }

  async checkOut(userId: string, updateDto: UpdateAttendanceDto): Promise<StaffAttendance> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.attendanceRepository.findOne({
      where: {
        userId,
        date: today,
      },
    });

    if (!attendance) {
      throw new NotFoundException('No check-in record found for today');
    }

    if (attendance.checkOut) {
      throw new BadRequestException('Already checked out');
    }

    attendance.checkOut = updateDto.checkOut || new Date().toLocaleTimeString();
    if (updateDto.notes) attendance.notes = updateDto.notes;

    return this.attendanceRepository.save(attendance);
  }

  async getAttendance(userId: string, startDate: Date, endDate: Date): Promise<StaffAttendance[]> {
    return this.attendanceRepository.find({
      where: {
        userId,
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
    });
  }

  async getAllStaffAttendance(startDate: Date, endDate: Date): Promise<any> {
    const attendances = await this.attendanceRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
    });

    const summary = {
      totalDays: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
    };

    attendances.forEach(att => {
      summary.totalDays++;
      switch (att.status) {
        case 'present': summary.present++; break;
        case 'absent': summary.absent++; break;
        case 'late': summary.late++; break;
        case 'half_day': summary.halfDay++; break;
      }
    });

    return { attendances, summary };
  }
}