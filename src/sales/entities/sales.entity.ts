import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../auth/entities/auth.entity';
import { SaleItem } from './sale-item.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod: string;

  @Column({ name: 'payment_status', type: 'varchar', default: 'completed' })
  paymentStatus: string;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'createdAt', type: 'datetime', precision: 6 })
  createdAt: Date;

  @OneToMany(() => SaleItem, (item) => item.sale)
  items: SaleItem[];
}