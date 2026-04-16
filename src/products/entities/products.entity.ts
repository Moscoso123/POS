import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost_price: number;

  @Column({ name: 'stock_quantity', default: 0 })
  stock_quantity: number;

  @Column({ name: 'min_stock_level', default: 5 })
  min_stock_level: number;

  @Column({ nullable: true })
  barcode: string;

  @Column({ name: 'image_url', nullable: true })
  image_url: string;

  @Column({ name: 'expiration_date', type: 'datetime', nullable: true })
  expiration_date: Date | null;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'datetime', precision: 6 })
  updatedAt: Date;

  // Remove the problematic relationships for now, we'll add them later
  // @OneToMany(() => SaleItem, saleItem => saleItem.product)
  // saleItems: SaleItem[];

  // @OneToMany(() => InventoryTransaction, transaction => transaction.product)
  // inventoryTransactions: InventoryTransaction[];
}