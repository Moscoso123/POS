import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as os from 'os';
import { Logger, RequestMethod } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import helmet from 'helmet';

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

  // Set global prefix for API routes to avoid conflicts with static files
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  // 🔐 Security: Add Helmet for security headers with CSP policy
  // Disable problematic headers in development to allow HTTP connections
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginOpenerPolicy: isDevelopment ? false : { policy: "same-origin" },
    crossOriginResourcePolicy: isDevelopment ? false : { policy: "same-origin" },
    originAgentCluster: isDevelopment ? false : true,
  }));

  // 🔐 Security: Enable CORS for same-origin and allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : true; // Allow all origins in development
  
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 🔐 Security: Set additional security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Only use HSTS in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // IMPORTANT: Serve static files AFTER setting up routes
  app.use('/', express.static(join(__dirname, '..', 'public')));
  
  // 🔐 Security: Serve uploads with restricted content type
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(join(__dirname, '..', 'uploads')));

  // Listen on all interfaces
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  // Get local network IPs
  const nets = os.networkInterfaces();
  const networkAddresses: string[] = [];
  
  for (const name of Object.keys(nets)) {
    const netInterfaces = nets[name];
    if (netInterfaces && Array.isArray(netInterfaces)) {
      for (const net of netInterfaces) {
        // Support both Node.js versions (family as string or number)
        const isIPv4 = net.family === 'IPv4' || (net.family as any) === 4;
        if (isIPv4 && !net.internal) {
          networkAddresses.push(net.address);
        }
      }
    }
  }

  logger.log('');
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log('🚀 BluePOS SERVER READY');
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log(`   📍 Local:     http://localhost:${port}`);
  
  if (networkAddresses.length > 0) {
    networkAddresses.forEach(address => {
      logger.log(`   📱 Network:   http://${address}:${port}`);
    });
    logger.log('');
    logger.log('   💡 Devices on the same WiFi can access using Network URL');
  } else {
    logger.log('   ⚠️  No network interface detected');
  }
  
  logger.log('═══════════════════════════════════════════════════════════');
  logger.log('   Starting Cloudflare tunnel...');

  // Auto-start Cloudflare tunnel
  startCloudflaredTunnel(+port, logger);
}
bootstrap();