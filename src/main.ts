import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as os from 'os';
import { Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

function startCloudflaredTunnel(port: number, logger: Logger): void {
  const cloudflaredPath = join(__dirname, '..', 'cloudflared.exe');

  if (!existsSync(cloudflaredPath)) {
    logger.warn('⚠️  cloudflared.exe not found — skipping tunnel');
    logger.warn(`   Expected at: ${cloudflaredPath}`);
    return;
  }

  const tunnel = spawn(cloudflaredPath, ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlFound = false;

  const handleOutput = (data: Buffer) => {
    const text = data.toString();
    if (!urlFound) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        urlFound = true;
        const onlineUrl = match[0];
        logger.log('');
        logger.log('═══════════════════════════════════════════════════════════');
        logger.log('🌐 CLOUDFLARE TUNNEL ACTIVE');
        logger.log('═══════════════════════════════════════════════════════════');
        logger.log(`   🔗 Online URL: ${onlineUrl}`);
        logger.log('');
        logger.log('   Share this link — anyone can access your POS system!');
        logger.log('═══════════════════════════════════════════════════════════');
      }
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('error', (err) => {
    logger.error(`❌ Cloudflare tunnel error: ${err.message}`);
  });

  tunnel.on('close', (code) => {
    if (code !== 0 && code !== null) {
      logger.warn(`⚠️  Cloudflare tunnel exited with code ${code}`);
    }
  });

  process.on('SIGINT', () => {
    tunnel.kill();
    process.exit();
  });
  process.on('SIGTERM', () => {
    tunnel.kill();
    process.exit();
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS
  app.enableCors();

  // IMPORTANT: Serve static files AFTER setting up routes
  app.use('/', express.static(join(__dirname, '..', 'public')));
  
  // Serve uploads folder if exists
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // Listen on all interfaces
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // Get local network IPs
  const nets = os.networkInterfaces();
  logger.log('');
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log('🚀 BluePOS SERVER READY');
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log(`   📍 Local:     http://localhost:${port}`);
  
  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name];
    if (netInterfaces && Array.isArray(netInterfaces)) {
      for (const net of netInterfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          logger.log(`   📍 Network:   http://${net.address}:${port}`);
        }
      }
    }
  }
  
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log('   Starting Cloudflare tunnel...');

  // Auto-start Cloudflare tunnel
  startCloudflaredTunnel(+port, logger);
}
bootstrap();