import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Add a simple root route
  app.use('/', (req, res) => {
    res.json({
      message: 'BluePOS API is running!',
      version: '1.0.0',
      endpoints: {
        auth: {
          login: 'POST /auth/login',
          register: 'POST /auth/register',
        },
        products: {
          list: 'GET /products',
          create: 'POST /products',
          get: 'GET /products/:id',
          update: 'PUT /products/:id',
          delete: 'DELETE /products/:id',
          stats: 'GET /products/stats',
          lowStock: 'GET /products/low-stock',
        },
        sales: {
          list: 'GET /sales',
          create: 'POST /sales',
          get: 'GET /sales/:id',
          stats: 'GET /sales/stats',
        },
        staff: {
          checkIn: 'POST /staff/check-in',
          checkOut: 'POST /staff/check-out',
          attendance: 'GET /staff/attendance',
          allAttendance: 'GET /staff/attendance/all',
        },
      },
    });
  });
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Test the API at: http://localhost:${port}/`);
}
bootstrap();