import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/',
  });
  
  app.enableCors();
  
  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
}
bootstrap();