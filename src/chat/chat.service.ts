import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat.entity';
import { User } from '../auth/entities/auth.entity';
import { AiLearningEntry } from './entities/ai-learning.entity';
import { Sale } from '../sales/entities/sales.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { Product } from '../products/entities/products.entity';
import { StaffAttendance } from '../staff/entities/staff-attendance.entity';

type MonitoringSnapshot = {
  todayRevenue: number;
  todaySalesCount: number;
  monthRevenue: number;
  topCashiersToday: Array<{ name: string; revenue: number; salesCount: number }>;
  topProductsToday: Array<{ name: string; quantity: number; revenue: number }>;
  lowestSellingProductsToday: Array<{ name: string; quantity: number; revenue: number }>;
  lowStockProducts: Array<{ name: string; stock: number; minStock: number }>;
  lowestStockProduct: { name: string; stock: number; minStock: number } | null;
  activeStaffToday: Array<{ name: string; status: string }>;
  latestSale: { cashierName: string; createdAt: Date | null; totalAmount: number } | null;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AiLearningEntry)
    private aiLearningRepository: Repository<AiLearningEntry>,
    @InjectRepository(Sale)
    private saleRepository: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepository: Repository<SaleItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StaffAttendance)
    private attendanceRepository: Repository<StaffAttendance>,
  ) {}

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount || 0));
  }

  private getTodayRange() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private getMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
    const { start: todayStart, end: todayEnd } = this.getTodayRange();
    const { start: monthStart, end: monthEnd } = this.getMonthRange();
    const todayDateString = todayStart.toISOString().slice(0, 10);

    const [todaySummaryRaw, monthSummaryRaw, topCashiersRaw, topProductsRaw, lowestSellingRaw, lowStockRaw, activeStaffRaw, latestSaleRaw] = await Promise.all([
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.totalAmount), 0)', 'todayRevenue')
        .addSelect('COUNT(sale.id)', 'todaySalesCount')
        .where('sale.createdAt BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .andWhere('sale.paymentStatus = :status', { status: 'completed' })
        .getRawOne(),
      this.saleRepository
        .createQueryBuilder('sale')
        .select('COALESCE(SUM(sale.totalAmount), 0)', 'monthRevenue')
        .where('sale.createdAt BETWEEN :start AND :end', { start: monthStart, end: monthEnd })
        .andWhere('sale.paymentStatus = :status', { status: 'completed' })
        .getRawOne(),
      this.saleRepository
        .createQueryBuilder('sale')
        .leftJoin('sale.user', 'user')
        .select('COALESCE(user.name, :unknown)', 'name')
        .addSelect('COALESCE(SUM(sale.totalAmount), 0)', 'revenue')
        .addSelect('COUNT(sale.id)', 'salesCount')
        .where('sale.createdAt BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .andWhere('sale.paymentStatus = :status', { status: 'completed' })
        .groupBy('sale.userId')
        .addGroupBy('user.name')
        .orderBy('SUM(sale.totalAmount)', 'DESC')
        .limit(3)
        .setParameter('unknown', 'Unknown Cashier')
        .getRawMany(),
      this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.product', 'product')
        .leftJoin('item.sale', 'sale')
        .select('COALESCE(product.name, :unknown)', 'name')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
        .addSelect('COALESCE(SUM(item.subtotal), 0)', 'revenue')
        .where('sale.createdAt BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .groupBy('item.productId')
        .addGroupBy('product.name')
        .orderBy('SUM(item.quantity)', 'DESC')
        .addOrderBy('SUM(item.subtotal)', 'DESC')
        .limit(5)
        .setParameter('unknown', 'Unknown Product')
        .getRawMany(),
      this.saleItemRepository
        .createQueryBuilder('item')
        .leftJoin('item.product', 'product')
        .leftJoin('item.sale', 'sale')
        .select('COALESCE(product.name, :unknown)', 'name')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
        .addSelect('COALESCE(SUM(item.subtotal), 0)', 'revenue')
        .where('sale.createdAt BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .groupBy('item.productId')
        .addGroupBy('product.name')
        .having('SUM(item.quantity) > 0')
        .orderBy('SUM(item.quantity)', 'ASC')
        .addOrderBy('SUM(item.subtotal)', 'ASC')
        .limit(5)
        .setParameter('unknown', 'Unknown Product')
        .getRawMany(),
      this.productRepository
        .createQueryBuilder('product')
        .select('product.name', 'name')
        .addSelect('product.stock_quantity', 'stock')
        .addSelect('product.min_stock_level', 'minStock')
        .where('product.is_active = :isActive', { isActive: true })
        .andWhere('product.stock_quantity <= product.min_stock_level')
        .orderBy('product.stock_quantity', 'ASC')
        .limit(5)
        .getRawMany(),
      this.attendanceRepository
        .createQueryBuilder('attendance')
        .leftJoin('attendance.user', 'user')
        .select('COALESCE(user.name, :unknown)', 'name')
        .addSelect('attendance.status', 'status')
        .where('attendance.date = :today', { today: todayDateString })
        .andWhere('attendance.status = :status', { status: 'present' })
        .orderBy('attendance.createdAt', 'DESC')
        .limit(5)
        .setParameter('unknown', 'Unknown Staff')
        .getRawMany(),
      this.saleRepository
        .createQueryBuilder('sale')
        .leftJoin('sale.user', 'user')
        .select('COALESCE(user.name, :unknown)', 'cashierName')
        .addSelect('sale.createdAt', 'createdAt')
        .addSelect('sale.totalAmount', 'totalAmount')
        .where('sale.paymentStatus = :status', { status: 'completed' })
        .orderBy('sale.createdAt', 'DESC')
        .limit(1)
        .setParameter('unknown', 'Unknown Cashier')
        .getRawOne(),
    ]);

    const lowStockProducts = (lowStockRaw || []).map((item) => ({
      name: item.name,
      stock: Number(item.stock || 0),
      minStock: Number(item.minStock || 0),
    }));

    return {
      todayRevenue: Number(todaySummaryRaw?.todayRevenue || 0),
      todaySalesCount: Number(todaySummaryRaw?.todaySalesCount || 0),
      monthRevenue: Number(monthSummaryRaw?.monthRevenue || 0),
      topCashiersToday: (topCashiersRaw || []).map((item) => ({
        name: item.name,
        revenue: Number(item.revenue || 0),
        salesCount: Number(item.salesCount || 0),
      })),
      topProductsToday: (topProductsRaw || []).map((item) => ({
        name: item.name,
        quantity: Number(item.quantity || 0),
        revenue: Number(item.revenue || 0),
      })),
      lowestSellingProductsToday: (lowestSellingRaw || []).map((item) => ({
        name: item.name,
        quantity: Number(item.quantity || 0),
        revenue: Number(item.revenue || 0),
      })),
      lowStockProducts,
      lowestStockProduct: lowStockProducts[0] || null,
      activeStaffToday: (activeStaffRaw || []).map((item) => ({
        name: item.name,
        status: item.status,
      })),
      latestSale: latestSaleRaw
        ? {
            cashierName: latestSaleRaw.cashierName,
            createdAt: latestSaleRaw.createdAt ? new Date(latestSaleRaw.createdAt) : null,
            totalAmount: Number(latestSaleRaw.totalAmount || 0),
          }
        : null,
    };
  }

  private buildMonitoringContext(snapshot: MonitoringSnapshot): string {
    const topCashier = snapshot.topCashiersToday[0];
    const topProduct = snapshot.topProductsToday[0];
    const lowestSellingProduct = snapshot.lowestSellingProductsToday[0];
    const latestSale = snapshot.latestSale;

    return [
      `Today revenue: ${this.formatCurrency(snapshot.todayRevenue)}`,
      `Today sales count: ${snapshot.todaySalesCount}`,
      `Month revenue: ${this.formatCurrency(snapshot.monthRevenue)}`,
      topCashier
        ? `Top cashier today: ${topCashier.name} with ${this.formatCurrency(topCashier.revenue)} from ${topCashier.salesCount} sale(s)`
        : 'Top cashier today: no completed sales yet',
      topProduct
        ? `Top product today: ${topProduct.name} with ${topProduct.quantity} units and ${this.formatCurrency(topProduct.revenue)} revenue`
        : 'Top product today: no sold products yet',
      lowestSellingProduct
        ? `Lowest selling product today: ${lowestSellingProduct.name} with ${lowestSellingProduct.quantity} units and ${this.formatCurrency(lowestSellingProduct.revenue)} revenue`
        : 'Lowest selling product today: no sold products yet',
      snapshot.lowStockProducts.length
        ? `Low stock items: ${snapshot.lowStockProducts.map((item) => `${item.name} (${item.stock}/${item.minStock})`).join(', ')}`
        : 'Low stock items: none',
      snapshot.lowestStockProduct
        ? `Lowest stock product right now: ${snapshot.lowestStockProduct.name} (${snapshot.lowestStockProduct.stock} remaining)`
        : 'Lowest stock product right now: none below threshold',
      snapshot.activeStaffToday.length
        ? `Active staff today: ${snapshot.activeStaffToday.map((item) => item.name).join(', ')}`
        : 'Active staff today: none recorded',
      latestSale?.createdAt
        ? `Latest sale: ${latestSale.cashierName} at ${latestSale.createdAt.toLocaleString()} for ${this.formatCurrency(latestSale.totalAmount)}`
        : 'Latest sale: none recorded',
    ].join('\n');
  }

  private getMonitoringLocalAnswer(message: string, snapshot: MonitoringSnapshot): string | null {
    const normalized = message.toLowerCase();
    const topCashier = snapshot.topCashiersToday[0];
    const topProduct = snapshot.topProductsToday[0];
    const lowestSellingProduct = snapshot.lowestSellingProductsToday[0];
    const lowestStockProduct = snapshot.lowestStockProduct;
    const latestSale = snapshot.latestSale;

    if (/(revenue|income|sales today|today sales|today revenue|how much today|daily sales)/i.test(normalized)) {
      return [
        `Today\'s revenue is ${this.formatCurrency(snapshot.todayRevenue)} from ${snapshot.todaySalesCount} completed sale(s).`,
        `This month\'s revenue so far is ${this.formatCurrency(snapshot.monthRevenue)}.`,
        topCashier
          ? `Top cashier today is ${topCashier.name} with ${this.formatCurrency(topCashier.revenue)}.`
          : 'There is no top cashier yet because no completed sales were found today.',
      ].join(' ');
    }

    if (/(top cashier|best cashier|highest cashier|leading cashier|who is top cashier)/i.test(normalized)) {
      if (!topCashier) {
        return 'No top cashier is available yet because there are no completed sales recorded today.';
      }

      return `${topCashier.name} is the top cashier today with ${this.formatCurrency(topCashier.revenue)} from ${topCashier.salesCount} completed sale(s).`;
    }

    if (/(top product|best seller|best-selling|most sold|top item|top selling)/i.test(normalized)) {
      if (!topProduct) {
        return 'No top product is available yet because there are no recorded sold items today.';
      }

      return `${topProduct.name} is the top product today with ${topProduct.quantity} unit(s) sold and ${this.formatCurrency(topProduct.revenue)} revenue.`;
    }

    if (/(highest product|highest selling product|highest item|most revenue product|best product today)/i.test(normalized)) {
      if (!topProduct) {
        return 'No highest product is available yet because there are no recorded sold items today.';
      }

      return `${topProduct.name} is the highest product today with ${topProduct.quantity} unit(s) sold and ${this.formatCurrency(topProduct.revenue)} revenue.`;
    }

    if (/(lowest product|lowest selling|least sold|bottom product|slowest product)/i.test(normalized)) {
      if (lowestSellingProduct) {
        return `${lowestSellingProduct.name} is the lowest selling product today with ${lowestSellingProduct.quantity} unit(s) sold and ${this.formatCurrency(lowestSellingProduct.revenue)} revenue.`;
      }

      if (lowestStockProduct) {
        return `${lowestStockProduct.name} currently has the lowest stock among low-stock items, with ${lowestStockProduct.stock} remaining against a minimum of ${lowestStockProduct.minStock}.`;
      }

      return 'I do not have a lowest product result yet because there are no sold items today and no low-stock items below threshold.';
    }

    if (/(low stock|critical stock|out of stock|inventory alert|what needs restock)/i.test(normalized)) {
      if (!snapshot.lowStockProducts.length) {
        return 'There are currently no low-stock products based on your configured minimum stock levels.';
      }

      return `Low-stock products right now: ${snapshot.lowStockProducts.map((item) => `${item.name} (${item.stock} remaining, minimum ${item.minStock})`).join(', ')}.`;
    }

    if (/(active staff|attendance|who is working|staff today|who checked in)/i.test(normalized)) {
      if (!snapshot.activeStaffToday.length) {
        return 'No active staff attendance has been recorded for today yet.';
      }

      return `Active staff today: ${snapshot.activeStaffToday.map((item) => item.name).join(', ')}.`;
    }

    if (/(when|last sale|latest sale|most recent sale|what time sale|recent sale)/i.test(normalized)) {
      if (!latestSale?.createdAt) {
        return 'There is no recent completed sale recorded yet.';
      }

      return `The latest completed sale was handled by ${latestSale.cashierName} at ${latestSale.createdAt.toLocaleString()} for ${this.formatCurrency(latestSale.totalAmount)}.`;
    }

    if (/(who|who is working|who sold|who made sales|who is best|who leads)/i.test(normalized)) {
      if (topCashier) {
        return `${topCashier.name} is currently the leading cashier today with ${this.formatCurrency(topCashier.revenue)} from ${topCashier.salesCount} sale(s).`;
      }

      if (snapshot.activeStaffToday.length) {
        return `Recorded staff active today: ${snapshot.activeStaffToday.map((item) => item.name).join(', ')}.`;
      }

      return 'I do not have enough sales or attendance data yet to answer who is leading today.';
    }

    if (/(monitor|monitoring|business status|summary today|how is business|store performance|today summary)/i.test(normalized)) {
      return [
        `Today\'s revenue is ${this.formatCurrency(snapshot.todayRevenue)} from ${snapshot.todaySalesCount} sale(s).`,
        topCashier
          ? `Top cashier: ${topCashier.name} with ${this.formatCurrency(topCashier.revenue)}.`
          : 'Top cashier: no completed sales yet.',
        topProduct
          ? `Top product: ${topProduct.name} with ${topProduct.quantity} unit(s) sold.`
          : 'Top product: no sold products yet.',
        snapshot.lowStockProducts.length
          ? `Low-stock alerts: ${snapshot.lowStockProducts.map((item) => item.name).join(', ')}.`
          : 'Low-stock alerts: none.',
      ].join(' ');
    }

    return null;
  }

  private tokenize(text: string): string[] {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  private jaccardSimilarity(a: string, b: string): number {
    const aTokens = new Set(this.tokenize(a));
    const bTokens = new Set(this.tokenize(b));

    if (aTokens.size === 0 || bTokens.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) {
        intersection += 1;
      }
    }

    const union = new Set([...aTokens, ...bTokens]).size;
    return union > 0 ? intersection / union : 0;
  }

  private async getAdaptiveLearningContext(userId: string, prompt: string): Promise<string> {
    const candidates = await this.aiLearningRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: 120,
    });

    if (!candidates.length) {
      return '';
    }

    const ranked = candidates
      .map((item) => {
        const promptSimilarity = this.jaccardSimilarity(prompt, item.prompt || '');
        const correctionSimilarity = item.correction ? this.jaccardSimilarity(prompt, item.correction) : 0;
        const bestSimilarity = Math.max(promptSimilarity, correctionSimilarity);
        const scoreBoost = Math.max(0, item.feedbackScore || 0) * 0.03;
        return {
          item,
          score: bestSimilarity + scoreBoost,
        };
      })
      .filter((entry) => entry.score > 0.08)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (!ranked.length) {
      return '';
    }

    return ranked
      .map(({ item }, index) => {
        const preferredAnswer = item.correction?.trim() || item.reply?.trim() || '';
        return [
          `Example ${index + 1}:`,
          `User asked: ${item.prompt}`,
          `Preferred answer style/content: ${preferredAnswer}`,
        ].join('\n');
      })
      .join('\n\n');
  }

  private async saveAssistantLearningEntry(userId: string, prompt: string, reply: string): Promise<void> {
    const entry = this.aiLearningRepository.create({
      userId,
      prompt,
      reply,
      correction: null,
      feedbackScore: 0,
    });

    await this.aiLearningRepository.save(entry);
  }

  async sendMessage(senderId: string, receiverId: string, message: string) {
    try {
      // Validate both IDs exist and are valid
      console.log('💬 Chat Service - sendMessage:', { senderId, receiverId, message });
      
      if (!senderId || !receiverId || senderId === receiverId) {
        throw new Error('Invalid sender or receiver ID');
      }

      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      // Verify both users exist in database
      const sender = await this.userRepository.findOne({ where: { id: senderId } });
      if (!sender) {
        throw new Error(`Sender user not found: ${senderId}`);
      }

      const receiver = await this.userRepository.findOne({ where: { id: receiverId } });
      if (!receiver) {
        throw new Error(`Receiver user not found: ${receiverId}`);
      }

      const chatMessage = this.chatRepository.create({
        senderId,
        receiverId,
        message: message.trim(),
        isRead: false,
      });
      
      console.log('💬 Chat Service - Creating message:', chatMessage);
      const saved = await this.chatRepository.save(chatMessage);
      console.log('💬 Chat Service - Message saved:', saved);
      return { success: true, data: saved };
    } catch (error) {
      console.error('💬 Chat Service Error:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to send message: ${message}`);
    }
  }

  async getConversation(userId: string, otherUserId: string, limit: number = 50) {
    try {
      const messages = await this.chatRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('(msg.senderId = :userId AND msg.receiverId = :otherUserId) OR (msg.senderId = :otherUserId AND msg.receiverId = :userId)', 
          { userId, otherUserId })
        .orderBy('msg.createdAt', 'ASC')
        .take(limit)
        .getMany();
      return messages;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get conversation: ${message}`);
    }
  }

  async getContacts(userId: string) {
    try {
      console.log('💬 Chat Service - getContacts for user:', userId);
      
      // Verify user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        console.warn('💬 User not found:', userId);
        return [];
      }

      const messages = await this.chatRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('msg.senderId = :userId OR msg.receiverId = :userId', { userId })
        .orderBy('msg.createdAt', 'DESC')
        .getMany();

      const contactMap = new Map();
      messages.forEach((msg) => {
        const contactId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!contactMap.has(contactId)) {
          contactMap.set(contactId, msg);
        }
      });

      console.log('💬 Found contacts:', contactMap.size);
      return Array.from(contactMap.values());
    } catch (error) {
      console.error('💬 Error in getContacts:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get contacts: ${message}`);
    }
  }

  async markAsRead(messageId: string) {
    try {
      await this.chatRepository.update(messageId, { isRead: true });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to mark as read: ${message}`);
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await this.chatRepository.count({
        where: { receiverId: userId, isRead: false },
      });
      return count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get unread count: ${message}`);
    }
  }

  private async getOpenAiAssistantReply(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    learnedContext: string,
    monitoringContext: string,
    userType?: string,
  ): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const systemPrompt = [
      'You are BluePOS Assistant.',
      'Speak naturally like a modern chat assistant.',
      'Help users with POS workflows, troubleshooting, reporting, inventory, settings, and day-to-day app usage.',
      'Respond based on the user request directly; do not force fixed templates.',
      'If the user says simple things like hi, hello, thanks, or asks short casual questions, reply naturally and then offer relevant help for this POS app.',
      'Stay focused on this app and related business operations. If the user asks something totally unrelated, answer briefly and redirect to how you can help inside BluePOS.',
      'Provide ordered steps when the user asks how-to questions, but use normal chat style for greetings and follow-ups.',
      userType === 'staff'
        ? 'User role is staff. Mention when an action may require admin permissions.'
        : 'User role is admin unless stated otherwise.',
      learnedContext
        ? `Use these learned examples when relevant:\n${learnedContext}`
        : '',
      monitoringContext
        ? `Use this live business monitoring snapshot when the user asks for revenue, cashier, product, stock, or store performance:\n${monitoringContext}`
        : '',
    ].join(' ');

    const trimmedHistory = history.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const payload = {
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        ...trimmedHistory.map((item) => ({
          role: item.role,
          content: [{ type: 'input_text', text: item.content }],
        })),
        { role: 'user', content: [{ type: 'input_text', text: message }] },
      ],
      max_output_tokens: 500,
    };

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        output_text?: string;
      };

      const text = (data?.output_text || '').trim();
      return text || null;
    } catch {
      return null;
    }
  }

  private getLocalAssistantFallback(
    message: string,
    learnedContext: string,
    monitoringSnapshot: MonitoringSnapshot | null,
    userType?: string,
  ): string {
    const normalizedMessage = (message || '').trim();
    const normalized = normalizedMessage.toLowerCase();
    const appIntentPattern = /(bluepos|pos|product|products|inventory|stock|cashier|staff|attendance|report|reports|pdf|print|dashboard|settings|password|profile|sale|sales|revenue|income|top|highest|lowest|monitor|business|checkout|counter|receipt|payment|login|logout|account|feature|app|system)/i;

    if (monitoringSnapshot) {
      const monitoringAnswer = this.getMonitoringLocalAnswer(normalizedMessage, monitoringSnapshot);
      if (monitoringAnswer) {
        return monitoringAnswer;
      }
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(normalized)) {
      return [
        'Hello. I can help you use BluePOS.',
        '',
        'You can ask me things like:',
        '1. How do I process a sale?',
        '2. How do I print or save a report?',
        '3. How do I update product stock?',
        '4. Why is a feature not working?',
      ].join('\n');
    }

    if (/^(thank you|thanks|ty)\b/i.test(normalized)) {
      return 'You are welcome. If you want, ask me about any BluePOS feature and I will help step by step.';
    }

    if (/who are you|what can you do|help me|can you help/i.test(normalized)) {
      return [
        'I am your BluePOS chat assistant.',
        '',
        'I can help with:',
        '1. POS checkout and payment flow',
        '2. Products, pricing, and inventory',
        '3. Sales history and reports',
        '4. Staff and account settings',
        '5. Troubleshooting app issues',
        '6. Monitoring live business data like revenue, top cashier, and low-stock products',
        '',
        'Tell me what you want to do in the app.',
      ].join('\n');
    }

    if (!appIntentPattern.test(normalized)) {
      return 'This request is not part of app.';
    }

    if (/(what can ai do|what can you answer|what can you monitor|what can you do)/i.test(normalized)) {
      return [
        'I can answer app questions and monitoring questions inside BluePOS.',
        '',
        'Examples:',
        '1. Who is the top cashier today?',
        '2. What is today\'s revenue?',
        '3. When was the last sale made?',
        '4. Where can I print reports?',
        '5. How do I process a sale?',
        '6. What is the lowest selling product today?',
        '7. Which items are low stock right now?',
        '',
        'I stay focused on this POS app and your business data.',
      ].join('\n');
    }

    if (/(where|where is|where can i find|where do i find)/i.test(normalized)) {
      if (/(report|pdf|print)/i.test(normalized)) {
        return 'You can find Reports in the left sidebar. Open Reports, set your date range, then use Save as PDF or Print Data Only at the bottom of the report panel.';
      }

      if (/(product|inventory|stock)/i.test(normalized)) {
        return 'You can find product and inventory controls in Products on the left sidebar. That is where you add items, edit pricing, and adjust stock.';
      }

      if (/(settings|password|profile|account)/i.test(normalized)) {
        return 'You can find account and security options in Settings on the left sidebar.';
      }

      if (/(pos|checkout|sale|counter)/i.test(normalized)) {
        return 'You can find the checkout workflow in POS Counter on the left sidebar.';
      }

      return 'Most main features are in the left sidebar: Dashboard, POS Counter, Products, Sales History, Reports, and Settings.';
    }

    if (/(how|how do i|how can i|steps|guide me)/i.test(normalized)) {
      return 'I can guide you step by step. Tell me the exact task, like how to process a sale, how to print a report, how to update stock, or how to change your password.';
    }

    if (learnedContext) {
      return [
        'I found similar previous requests from your usage and adapted this response.',
        '',
        `Request: ${normalizedMessage}`,
        '',
        'Suggested response:',
        '1. Follow the same workflow pattern used in your previous successful requests.',
        '2. If you share the exact screen or error, I will provide click-by-click steps.',
        '',
        'Learned context considered:',
        learnedContext,
      ].join('\n');
    }

    const guides: Array<{
      key: string;
      title: string;
      description: string;
      steps: string[];
      match: RegExp;
    }> = [
      {
        key: 'dashboard',
        title: 'Dashboard Overview',
        description: 'How to read and use your dashboard quickly.',
        match: /(dashboard|overview|summary|chart|stats|analytics)/i,
        steps: [
          'Open Dashboard from the left sidebar.',
          'Review top metrics first: sales, stock, and activity counts.',
          'Check chart trends for unusual drops or spikes.',
          'Use dashboard insights to decide whether to restock or review sales details.',
        ],
      },
      {
        key: 'pos',
        title: 'POS Counter Flow',
        description: 'Complete checkout flow from cart to payment.',
        match: /(pos|checkout|counter|cart|payment|invoice|receipt|sell|sale)/i,
        steps: [
          'Go to POS Counter from the sidebar.',
          'Search or select products to add them to cart.',
          'Adjust quantity and verify stock availability.',
          'Choose payment method and confirm sale.',
          'Save or print the receipt and verify the transaction appears in Sales History.',
        ],
      },
      {
        key: 'products',
        title: 'Products and Inventory',
        description: 'Manage product catalog and stock safely.',
        match: /(product|inventory|stock|item|category|price|adjust)/i,
        steps: [
          'Open Products in the sidebar.',
          'Use Add Product to create a new item with price and stock.',
          'Use Edit for price or details updates.',
          'Use inventory adjustment when stock changes outside normal sales.',
          'Monitor low-stock notifications and replenish before outages.',
        ],
      },
      {
        key: 'sales',
        title: 'Sales History and Review',
        description: 'Track and verify completed sales records.',
        match: /(sales history|sales|transaction|order|history|void|refund)/i,
        steps: [
          'Open Sales History from the sidebar.',
          'Filter by date range to narrow transaction records.',
          'Review line items, totals, cashier, and payment method.',
          'Use reports export or print for accounting and audits.',
        ],
      },
      {
        key: 'staff',
        title: 'Staff Management',
        description: 'Invite and manage cashier access.',
        match: /(staff|cashier|employee|invite|role|attendance)/i,
        steps: [
          'Open Cashier page from the sidebar.',
          'Invite new staff using their email and role.',
          'Verify active/inactive status and remove access for former staff.',
          'Check attendance and account activity regularly.',
        ],
      },
      {
        key: 'reports',
        title: 'Reports and Exports',
        description: 'Generate daily/period reports and export outputs.',
        match: /(report|analytics|pdf|print|export|date range|summary)/i,
        steps: [
          'Open Reports from the sidebar.',
          'Set From and To dates to filter report rows.',
          'Review totals and item-level rows for accuracy.',
          'Use Save as PDF for file export or Print Data Only for hardcopy.',
        ],
      },
      {
        key: 'settings',
        title: 'Account and Security Settings',
        description: 'Update profile and protect account access.',
        match: /(settings|profile|password|security|account|theme)/i,
        steps: [
          'Open Settings in the sidebar.',
          'Update profile information and save changes.',
          'Use Change Password and complete verification code flow.',
          'Log out on shared devices after account updates.',
        ],
      },
    ];

    const matched = guides.find((guide) => guide.match.test(normalized));
    const selected = matched || {
      key: 'general',
      title: 'General App Navigation',
      description: 'Start here if you are unsure what module to use.',
      steps: [
        'Use the left sidebar to open Dashboard, POS Counter, Products, Sales History, Reports, or Settings.',
        'Complete one workflow at a time: add products, then sell, then review reports.',
        'Use Reports for daily closing and PDF/print exports.',
        'Use Settings for profile and password changes.',
      ],
    };

    const roleNote = userType === 'staff'
      ? 'Note: some actions may require admin access.'
      : 'You have admin-level access for all management modules.';

    const stepsText = selected.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');

    return [
      `Here is the best help I can give for your request in BluePOS:`,
      '',
      `${selected.title}`,
      `${selected.description}`,
      '',
      `${stepsText}`,
      '',
      roleNote,
      '',
      'If you want, ask a follow-up like: "show exact clicks", "where is that button", or "troubleshoot this error".',
    ].join('\n');
  }

  async getAssistantChatReply(
    userId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    userType?: string,
  ) {
    const trimmedMessage = (message || '').trim();
    if (!trimmedMessage) {
      throw new Error('Message is required');
    }

    if (trimmedMessage.length > 2000) {
      throw new Error('Message is too long');
    }

    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .map((item) => ({ role: item.role, content: item.content.slice(0, 1000) }));

    const learnedContext = await this.getAdaptiveLearningContext(userId, trimmedMessage);
    const monitoringSnapshot = await this.getMonitoringSnapshot().catch(() => null);
    const monitoringContext = monitoringSnapshot ? this.buildMonitoringContext(monitoringSnapshot) : '';

    const openAiReply = await this.getOpenAiAssistantReply(trimmedMessage, safeHistory, learnedContext, monitoringContext, userType);
    if (openAiReply) {
      await this.saveAssistantLearningEntry(userId, trimmedMessage, openAiReply);
      return {
        reply: openAiReply,
        provider: 'openai',
      };
    }

    const fallbackReply = this.getLocalAssistantFallback(trimmedMessage, learnedContext, monitoringSnapshot, userType);
    await this.saveAssistantLearningEntry(userId, trimmedMessage, fallbackReply);

    return {
      reply: fallbackReply,
      provider: 'local-fallback',
    };
  }

  async submitAssistantFeedback(options: {
    userId: string;
    prompt: string;
    correction?: string;
    feedbackScore?: number;
  }) {
    const prompt = (options.prompt || '').trim();
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const recent = await this.aiLearningRepository.findOne({
      where: { userId: options.userId, prompt },
      order: { createdAt: 'DESC' },
    });

    if (!recent) {
      throw new Error('No matching assistant interaction found for feedback');
    }

    if (typeof options.feedbackScore === 'number') {
      recent.feedbackScore = Math.max(-5, Math.min(5, options.feedbackScore));
    }

    if (options.correction && options.correction.trim()) {
      recent.correction = options.correction.trim().slice(0, 2000);
      recent.feedbackScore = Math.max(recent.feedbackScore, 3);
    }

    await this.aiLearningRepository.save(recent);
    return { success: true };
  }
}
