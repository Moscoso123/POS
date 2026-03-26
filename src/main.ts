import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as os from 'os';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors();

  // Set global prefix for API routes (optional but recommended)
  // app.setGlobalPrefix('api'); // Uncomment if you want /api/attendance

  // IMPORTANT: Serve static files AFTER setting up routes
  // But better to use a different path for static files
  app.use('/', express.static(join(__dirname, '..', 'public')));
  
  // Serve uploads folder if exists
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // Listen on all interfaces
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // Get local network IPs
  const nets = os.networkInterfaces();
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log('✅ Server running on:');
  logger.log(`   • Local:       http://localhost:${port}`);
  
  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name];
    if (netInterfaces && Array.isArray(netInterfaces)) {
      for (const net of netInterfaces) {
        // Only IPv4 and non-internal addresses
        if (net.family === 'IPv4' && !net.internal) {
          logger.log(`   • Network:     http://${net.address}:${port}`);
        }
      }
    }
  }
  
  logger.log(`📱 Frontend login page:`);
  logger.log(`   • http://localhost:${port}/login.html`);
  logger.log(`🔍 API health endpoint:`);
  logger.log(`   • http://localhost:${port}/health`);
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log(`✨ Server is ready to accept connections from your local network`);
  logger.log(`💡 Share the Network URL with other devices on the same network`);
}
bootstrap();