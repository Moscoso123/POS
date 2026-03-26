import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sale } from './entities/sales.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    private productsService: ProductsService,
  ) {}

  async create(createSaleDto: CreateSaleDto, userId: string): Promise<Sale> {
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const sale = this.saleRepository.create({
      invoiceNumber,
      userId,
      totalAmount: createSaleDto.totalAmount,
      taxAmount: createSaleDto.taxAmount || 0,
      discountAmount: createSaleDto.discountAmount || 0,
      paymentMethod: createSaleDto.paymentMethod,
      customerName: createSaleDto.customerName,
      customerPhone: createSaleDto.customerPhone,
      notes: createSaleDto.notes,
    });

    const savedSale = await this.saleRepository.save(sale);

    for (const item of createSaleDto.items) {
      const saleItem = this.saleItemRepository.create({
        saleId: savedSale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      });
      await this.saleItemRepository.save(saleItem);

      await this.productsService.updateStock(
        item.productId,
        item.quantity,
        'sale',
        userId,
        savedSale.id
      );
    }

    return this.findOne(savedSale.id);
  }

  async findAll(page: number = 1, limit: number = 10): Promise<{ data: Sale[]; total: number }> {
    const [data, total] = await this.saleRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      relations: ['user'],
      where: { id },
    });
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }
    return sale;
  }

  async getSalesStats(startDate?: Date, endDate?: Date): Promise<any> {
    const whereCondition: any = {};
    if (startDate && endDate) {
      whereCondition.createdAt = Between(startDate, endDate);
    }

    const sales = await this.saleRepository.find({
      where: whereCondition,
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

    // Sum quantities to represent actual items sold
    const saleItems = await this.saleItemRepository.find();
    const totalItems = saleItems.reduce((sum, item) => sum + Number(item.quantity), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySales = await this.saleRepository.find({
      where: {
        createdAt: Between(today, tomorrow),
      },
    });

    const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

    const recentSales = await this.saleRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalSales,
      totalRevenue,
      totalItems,
      todaySales: todaySales.length,
      todayRevenue,
      recentSales,
    };
  }

  async getDailyRevenue(days: number = 14): Promise<any[]> {
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .select('DATE(sale.createdAt)', 'date')
      .addSelect('SUM(sale.total_amount)', 'revenue')
      .addSelect('COUNT(sale.id)', 'count')
      .where('sale.createdAt >= :since', { since })
      .groupBy('DATE(sale.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Fill missing days with 0
    const map = new Map(results.map(r => [r.date, r]));
    const filled: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key);
      filled.push({
        date: key,
        revenue: entry ? Number(entry.revenue) : 0,
        count: entry ? Number(entry.count) : 0,
      });
    }
    return filled;
  }

  async getTopStaff(limit: number = 5): Promise<any[]> {
    const results = await this.saleRepository
      .createQueryBuilder('sale')
      .leftJoin('sale.user', 'user')
      .select('sale.user_id', 'userId')
      .addSelect('user.name', 'name')
      .addSelect('user.profilePic', 'profilePic')
      .addSelect('COUNT(sale.id)', 'totalTransactions')
      .addSelect('SUM(sale.total_amount)', 'totalRevenue')
      .groupBy('sale.user_id')
      .addGroupBy('user.name')
      .addGroupBy('user.profilePic')
      .orderBy('totalRevenue', 'DESC')
      .limit(limit)
      .getRawMany();

    return results;
  }
}