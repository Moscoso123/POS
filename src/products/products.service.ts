import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/products.entity';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto, userId: string): Promise<Product> {
    const product = this.productRepository.create({
      ...createProductDto,
      stock_quantity: createProductDto.stock_quantity || 0,
      min_stock_level: createProductDto.min_stock_level || 5,
    });
    const savedProduct = await this.productRepository.save(product);
    return savedProduct;
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({ where: { is_active: true } });
  }

  async findAllWithLowStock(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity <= product.min_stock_level')
      .andWhere('product.is_active = :isActive', { isActive: true })
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

    return product;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    product.is_active = false;
    await this.productRepository.save(product);
  }

  async getDashboardStats(): Promise<any> {
    const totalProducts = await this.productRepository.count({ where: { is_active: true } });
    
    const lowStockCount = await this.productRepository
      .createQueryBuilder('product')
      .where('product.stock_quantity <= product.min_stock_level')
      .andWhere('product.is_active = :isActive', { isActive: true })
      .getCount();

    const totalStockValue = await this.productRepository
      .createQueryBuilder('product')
      .select('SUM(product.stock_quantity * product.cost_price)', 'total')
      .where('product.is_active = :isActive', { isActive: true })
      .getRawOne();

    return {
      totalProducts,
      lowStockCount,
      totalStockValue: totalStockValue?.total || 0,
    };
  }
}