import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './products.entity';
import { User } from '../../auth/entities/auth.entity';

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: ['purchase', 'sale', 'return', 'adjustment']
  })
  transactionType: string;

  @Column()
  quantity: number;

  @Column({ name: 'previous_stock' })
  previousStock: number;

  @Column({ name: 'new_stock' })
  newStock: number;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}