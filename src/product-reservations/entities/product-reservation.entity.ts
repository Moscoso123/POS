import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProductReservationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('product_reservations')
export class ProductReservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36 })
  productId!: string;

  @Column({ type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'varchar', length: 36 })
  clientId!: string;

  @Column({ type: 'varchar', length: 255 })
  clientName!: string;

  @Column({ type: 'int', unsigned: true })
  quantity!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({
    type: 'enum',
    enum: ProductReservationStatus,
    default: ProductReservationStatus.PENDING,
  })
  status!: ProductReservationStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedById!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewedByName!: string | null;

  @Column({ type: 'text', nullable: true })
  adminNote!: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt!: Date;
}
