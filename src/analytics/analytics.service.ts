import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Product } from '../products/entities/products.entity';
import { spawn } from 'node:child_process';
import * as path from 'node:path';

type CategoryRow = {
  category: string;
  quantity: string | number;
  revenue: string | number;
};

type ProductRow = {
  name: string;
  category: string;
  stock: string | number;
  minStock: string | number;
};

type PythonInsightResult = {
  highestCategory: {
    category: string;
    quantity: number;
    revenue: number;
  } | null;
  lowestCategory: {
    category: string;
    quantity: number;
    revenue: number;
  } | null;
  productsReachedLimit: Array<{
    name: string;
    category: string;
    stock: number;
    minStock: number;
  }>;
  answer: string;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getAiInsights(query: string): Promise<PythonInsightResult> {
    const [categoriesRaw, productsRaw] = await Promise.all([
      this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.product', 'product')
        .leftJoin('item.sale', 'sale')
        .select("COALESCE(product.category, 'Uncategorized')", 'category')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
        .addSelect('COALESCE(SUM(item.subtotal), 0)', 'revenue')
        .where('sale.paymentStatus = :status', { status: 'completed' })
        .groupBy('product.category')
        .getRawMany<CategoryRow>(),
      this.productRepository
        .createQueryBuilder('product')
        .select('product.name', 'name')
        .addSelect("COALESCE(product.category, 'Uncategorized')", 'category')
        .addSelect('product.stock_quantity', 'stock')
        .addSelect('product.min_stock_level', 'minStock')
        .where('(product.is_active = :isActive OR product.is_active IS NULL)', { isActive: true })
        .getRawMany<ProductRow>(),
    ]);

    const pythonPayload = {
      query,
      categories: (categoriesRaw || []).map((row) => ({
        category: row.category,
        quantity: Number(row.quantity || 0),
        revenue: Number(row.revenue || 0),
      })),
      products: (productsRaw || []).map((row) => ({
        name: row.name,
        category: row.category,
        stock: Number(row.stock || 0),
        minStock: Number(row.minStock || 0),
      })),
    };

    return this.runPythonInsights(pythonPayload);
  }

  private async runPythonInsights(payload: {
    query: string;
    categories: Array<{ category: string; quantity: number; revenue: number }>;
    products: Array<{ name: string; category: string; stock: number; minStock: number }>;
  }): Promise<PythonInsightResult> {
    const scriptPath = path.resolve(process.cwd(), 'python', 'ai_analytics.py');
    const pythonOptions: Array<{ command: string; args: string[] }> = [
      ...(process.env.PYTHON_BIN ? [{ command: process.env.PYTHON_BIN, args: [scriptPath] }] : []),
      { command: 'python', args: [scriptPath] },
      { command: 'py', args: ['-3', scriptPath] },
    ];

    let lastError: unknown;
    for (const option of pythonOptions) {
      try {
        const stdout = await this.executePython(option.command, option.args, payload);
        const parsed = JSON.parse(stdout) as PythonInsightResult;
        return parsed;
      } catch (error) {
        lastError = error;
      }
    }

    throw new InternalServerErrorException(
      `Python analytics execution failed. Install Python or set PYTHON_BIN. Details: ${String(lastError)}`,
    );
  }

  private executePython(
    command: string,
    args: string[],
    payload: {
      query: string;
      categories: Array<{ category: string; quantity: number; revenue: number }>;
      products: Array<{ name: string; category: string; stock: number; minStock: number }>;
    },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Python process timed out for command: ${command}`));
      }, 15000);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}. ${stderr}`));
          return;
        }
        resolve(stdout);
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }
}
