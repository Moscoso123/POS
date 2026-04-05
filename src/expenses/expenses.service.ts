import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { Sale } from '../sales/entities/sales.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,
  ) {}

  async create(createExpenseDto: CreateExpenseDto, userId: string) {
    const expense = this.expenseRepository.create({
      title: String(createExpenseDto.title || '').trim(),
      amount: Number(createExpenseDto.amount || 0),
      notes: null,
      userId,
    });

    const savedExpense = await this.expenseRepository.save(expense);
    return this.expenseRepository.findOne({
      where: { id: savedExpense.id },
      relations: ['user'],
    });
  }

  async findRecent(limit: number = 10) {
    const rows = await this.expenseRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return rows.map((row) => ({
      ...row,
      amount: Number(row.amount || 0),
    }));
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (typeof updateExpenseDto.title === 'string') {
      expense.title = updateExpenseDto.title.trim();
    }

    if (typeof updateExpenseDto.amount === 'number') {
      expense.amount = Number(updateExpenseDto.amount);
    }

    const saved = await this.expenseRepository.save(expense);
    return {
      ...saved,
      amount: Number(saved.amount || 0),
    };
  }

  async remove(id: string) {
    const expense = await this.expenseRepository.findOne({ where: { id } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.expenseRepository.remove(expense);
    return { success: true, message: 'Expense deleted successfully.' };
  }

  async getSummary(limit: number = 8, startDate?: Date) {
    const [expenseRows, recentExpensesAll, salesAgg] = await Promise.all([
      this.expenseRepository.find({
        select: ['amount', 'createdAt'],
      }),
      this.expenseRepository.find({
        relations: ['user'],
        order: { createdAt: 'DESC' },
      }),
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.total_amount), 0)', 'totalRevenue')
        .where(startDate ? 'sale.createdAt >= :startDate' : '1=1', startDate ? { startDate } : {})
        .getRawOne<{ totalRevenue: string }>(),
    ]);

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // If startDate is provided, filter expense rows from that date onward
    const filteredRows = startDate
      ? (expenseRows || []).filter((row) => {
          const d = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt || ''));
          return !Number.isNaN(d.getTime()) && d >= startDate;
        })
      : (expenseRows || []);

    const totalExpenses = filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const todayExpenses = filteredRows.reduce((sum, row) => {
      const dateValue = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt || ''));
      if (Number.isNaN(dateValue.getTime())) {
        return sum;
      }

      const rowKey = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
      return rowKey === todayKey ? sum + Number(row.amount || 0) : sum;
    }, 0);

    const totalRevenue = Number(salesAgg?.totalRevenue || 0);

    // Filter recentExpenses by startDate and limit
    const recentExpenses = (recentExpensesAll || [])
      .filter((row) => {
        if (!startDate) return true;
        const d = row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt || ''));
        return !Number.isNaN(d.getTime()) && d >= startDate;
      })
      .slice(0, limit)
      .map((row) => ({ ...row, amount: Number(row.amount || 0) }));

    return {
      totalExpenses,
      todayExpenses,
      totalRevenue,
      netIncome: Number((totalRevenue - totalExpenses).toFixed(2)),
      recentExpenses,
    };
  }

  async getDailyExpenses(days: number = 14) {
    const toLocalDateKey = (dateValue: Date): string => {
      const y = dateValue.getFullYear();
      const m = String(dateValue.getMonth() + 1).padStart(2, '0');
      const d = String(dateValue.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const normalizeDateKey = (value: unknown): string => {
      if (typeof value === 'string') {
        return value.slice(0, 10);
      }
      if (value instanceof Date) {
        return toLocalDateKey(value);
      }

      const parsed = new Date(String(value || ''));
      return Number.isNaN(parsed.getTime()) ? '' : toLocalDateKey(parsed);
    };

    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const until = new Date();
    until.setHours(23, 59, 59, 999);

    const results = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('DATE(expense.createdAt)', 'date')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'amount')
      .addSelect('COUNT(expense.id)', 'count')
      .where('expense.createdAt >= :since AND expense.createdAt <= :until', { since, until })
      .groupBy('DATE(expense.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; amount: string; count: string }>();

    const resultMap = new Map(results.map((row) => [normalizeDateKey(row.date), row]));
    const filled: Array<{ date: string; amount: number; count: number }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(since);
      date.setDate(date.getDate() + i);
      const key = toLocalDateKey(date);
      const row = resultMap.get(key);

      filled.push({
        date: key,
        amount: row ? Number(row.amount || 0) : 0,
        count: row ? Number(row.count || 0) : 0,
      });
    }

    return filled;
  }

  async resetAll(): Promise<{ success: boolean; message: string }> {
    await this.expenseRepository.createQueryBuilder().delete().execute();
    return { success: true, message: 'All expense records have been deleted.' };
  }
}