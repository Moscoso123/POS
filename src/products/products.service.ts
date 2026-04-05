import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/products.entity';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { InventoryTransaction } from './entities/inventory-transaction.entity';
import { InventoryAdjustmentDto } from './dto/inventory-adjustment.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(InventoryTransaction)
    private inventoryTransactionRepository: Repository<InventoryTransaction>,
  ) {}

  async create(createProductDto: CreateProductDto, userId: string): Promise<Product> {
    const sku = createProductDto.sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const product = this.productRepository.create({
      ...createProductDto,
      sku,
      stock_quantity: createProductDto.stock_quantity || 0,
      min_stock_level: createProductDto.min_stock_level || 5,
    });
    const savedProduct = await this.productRepository.save(product);
    return savedProduct;
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.is_active = :isActive OR product.is_active IS NULL', { isActive: true })
      .getMany();
  }

  async findAllWithLowStock(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity <= product.min_stock_level')
      .andWhere('(product.is_active = :isActive OR product.is_active IS NULL)', { isActive: true })
      .getMany();
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { sku } });
    if (!product) {
      throw new NotFoundException(`Product with SKU ${sku} not found`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async updateStock(id: string, quantity: number, type: string, userId: string, referenceId?: string): Promise<Product> {
    const product = await this.findOne(id);
    const previousStock = product.stock_quantity;
    let newStock = product.stock_quantity;

    if (type === 'sale') {
      if (product.stock_quantity < quantity) {
        throw new BadRequestException(`Insufficient stock for product ${product.name}`);
      }
      newStock = product.stock_quantity - quantity;
    } else if (type === 'purchase' || type === 'return') {
      newStock = product.stock_quantity + quantity;
    } else if (type === 'adjustment') {
      newStock = quantity;
    }

    product.stock_quantity = newStock;
    await this.productRepository.save(product);

    await this.inventoryTransactionRepository.save(
      this.inventoryTransactionRepository.create({
        productId: id,
        transactionType: type,
        quantity,
        previousStock,
        newStock,
        referenceId,
        userId,
        notes: type === 'sale' ? 'Auto deduction from sale transaction' : undefined,
      }),
    );

    return product;
  }

  async adjustInventory(dto: InventoryAdjustmentDto, userId: string): Promise<Product> {
    const product = await this.findOne(dto.productId);
    const previousStock = product.stock_quantity;
    let newStock = previousStock;

    if (dto.transactionType === 'adjustment') {
      newStock = dto.quantity;
    } else {
      newStock = previousStock + dto.quantity;
    }

    product.stock_quantity = newStock;
    await this.productRepository.save(product);

    await this.inventoryTransactionRepository.save(
      this.inventoryTransactionRepository.create({
        productId: product.id,
        transactionType: dto.transactionType,
        quantity: dto.quantity,
        previousStock,
        newStock,
        notes: dto.notes || undefined,
        userId,
      }),
    );

    return product;
  }

  async getRecentInventoryTransactions(limit = 20): Promise<InventoryTransaction[]> {
    return this.inventoryTransactionRepository.find({
      relations: ['product'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getProductHistory(productId: string, limit = 100): Promise<InventoryTransaction[]> {
    await this.findOne(productId);

    return this.inventoryTransactionRepository.find({
      where: { productId },
      relations: ['product', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getInventoryChartData(days = 7): Promise<{ labels: string[]; in: number[]; out: number[] }> {
    const safeDays = Math.max(1, Math.min(days, 30));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));

    const txns = await this.inventoryTransactionRepository
      .createQueryBuilder('t')
      .where('t.createdAt >= :start', { start })
      .orderBy('t.createdAt', 'ASC')
      .getMany();

    const labels: string[] = [];
    const incomingMap = new Map<string, number>();
    const outgoingMap = new Map<string, number>();

    for (let i = 0; i < safeDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      incomingMap.set(key, 0);
      outgoingMap.set(key, 0);
    }

    txns.forEach((txn) => {
      const key = new Date(txn.createdAt).toISOString().slice(0, 10);
      if (!incomingMap.has(key)) return;

      if (txn.transactionType === 'sale') {
        outgoingMap.set(key, (outgoingMap.get(key) || 0) + Number(txn.quantity));
      } else {
        incomingMap.set(key, (incomingMap.get(key) || 0) + Number(txn.quantity));
      }
    });

    return {
      labels,
      in: labels.map((l) => incomingMap.get(l) || 0),
      out: labels.map((l) => outgoingMap.get(l) || 0),
    };
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.is_active = false;
    await this.productRepository.save(product);
  }

  async resetAll(): Promise<{ success: boolean; message: string }> {
    await this.inventoryTransactionRepository.createQueryBuilder().delete().execute();
    await this.productRepository.createQueryBuilder().delete().execute();
    return { success: true, message: 'All products and inventory records have been deleted.' };
  }

  async getDashboardStats(): Promise<any> {
    const totalProducts = await this.productRepository
      .createQueryBuilder('product')
      .where('product.is_active = :isActive OR product.is_active IS NULL', { isActive: true })
      .getCount();
    
    const lowStockCount = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity <= product.min_stock_level')
      .andWhere('(product.is_active = :isActive OR product.is_active IS NULL)', { isActive: true })
      .getCount();

    const totalStockValue = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.stock_quantity * product.cost_price)', 'total')
      .where('product.is_active = :isActive OR product.is_active IS NULL', { isActive: true })
      .getRawOne();

    return {
      totalProducts,
      lowStockCount,
      totalStockValue: totalStockValue?.total || 0,
    };
  }
}