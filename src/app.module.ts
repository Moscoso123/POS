import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { StaffModule } from './staff/staff.module';
import { EmailModule } from './email/email.module';
import { ChatModule } from './chat/chat.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StatisticsModule } from './statistics/statistics.module';
import { ProductReservationsModule } from './product-reservations/product-reservations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'pos',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    }),
    EmailModule,
    AuthModule,
    ProductsModule,
    SalesModule,
    StaffModule,
    ChatModule,
    AnalyticsModule,
    ExpensesModule,
    StatisticsModule,
    ProductReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}