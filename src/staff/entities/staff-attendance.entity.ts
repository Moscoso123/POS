import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('staff_attendance')
export class StaffAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ name: 'check_in', type: 'time', nullable: true })
  checkIn: string;

  @Column({ name: 'check_out', type: 'time', nullable: true })
  checkOut: string;

  @Column({ type: 'varchar', default: 'present' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'createdAt', type: 'datetime', precision: 6 })
  createdAt: Date;
}