import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as os from 'os';
import { Logger, RequestMethod } from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { Server } from 'http';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();
const ddosPenaltyBox = new Map<string, number>();

const DDOS_BAN_MS = 10 * 60 * 1000;
const DDOS_TRIGGER_HITS = 8;

setInterval(() => {
  const now = Date.now();
  for (const [ip, expiresAt] of ddosPenaltyBox.entries()) {
    if (now >= expiresAt) {
      ddosPenaltyBox.delete(ip);
    }
  }

  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now > bucket.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000).unref();

function createRateLimiter(options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message: string;
  banOnRepeatedViolations?: boolean;
  trustForwardedFor?: boolean;
}) {
  const {
    windowMs,
    max,
    keyPrefix,
    message,
    banOnRepeatedViolations = false,
    trustForwardedFor = false,
  } = options;

  const getClientIp = (req: Request): string => {
    if (trustForwardedFor) {
      const forwardedForHeader = req.headers['x-forwarded-for'];
      if (typeof forwardedForHeader === 'string' && forwardedForHeader.trim()) {
        return forwardedForHeader.split(',')[0].trim();
      }
    }

    return req.ip || req.socket.remoteAddress || 'unknown';
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);
    const banExpiresAt = ddosPenaltyBox.get(clientIp);

    if (banExpiresAt && Date.now() < banExpiresAt) {
      const retryAfterSeconds = Math.max(1, Math.ceil((banExpiresAt - Date.now()) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return res.status(429).json({
        statusCode: 429,
        message: 'IP temporarily blocked due to suspicious traffic volume. Please retry later.',
      });
    }

    const key = `${keyPrefix}:${clientIp}`;
    const now = Date.now();
    const bucket = rateLimitStore.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds.toString());

      if (banOnRepeatedViolations && bucket.count >= max + DDOS_TRIGGER_HITS) {
        ddosPenaltyBox.set(clientIp, now + DDOS_BAN_MS);
      }

      return res.status(429).json({
        statusCode: 429,
        message,
      });
    }

    return next();
  };
}

const dangerousFilePattern = /\.(exe|bat|cmd|com|scr|pif|js|jse|vbs|vbe|wsf|wsh|ps1|msi|dll|jar|hta|sh|php|asp|aspx|jsp|py|rb)$/i;

function startCloudflaredTunnel(port: number, logger: Logger): void {
  const localCloudflaredPath = join(__dirname, '..', 'cloudflared.exe');
  const cloudflaredCommand = existsSync(localCloudflaredPath) ? localCloudflaredPath : 'cloudflared';

  if (cloudflaredCommand === 'cloudflared') {
    logger.log('ℹ️  Using cloudflared from PATH');
  }

  const tunnel = spawn(cloudflaredCommand, ['tunnel', '--url', `http://localhost:${port}`], {
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
    if (cloudflaredCommand === 'cloudflared') {
      logger.error('   Ensure cloudflared is installed and available in PATH.');
    }
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
  const trustForwardedFor = process.env.TRUST_PROXY === 'true';

  if (trustForwardedFor) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
  }

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

  // Restrict request payload size to reduce abuse and mass-upload attack surface.
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: true, limit: '200kb' }));

  // Baseline global rate limiter to reduce brute force and automated abuse.
  app.use(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 120,
      keyPrefix: 'global',
      message: 'Too many requests. Please try again later.',
      banOnRepeatedViolations: true,
      trustForwardedFor,
    }),
  );

  // Fast burst limiter for high-QPS spikes (typical DDoS pattern).
  app.use(
    createRateLimiter({
      windowMs: 10 * 1000,
      max: 40,
      keyPrefix: 'burst',
      message: 'Traffic spike detected. Slow down and retry shortly.',
      banOnRepeatedViolations: true,
      trustForwardedFor,
    }),
  );

  // Stricter limiter for auth routes, which are common ransomware/operator attack targets.
  app.use(
    '/api/auth',
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 20,
      keyPrefix: 'auth',
      message: 'Too many authentication attempts. Please wait and retry.',
      banOnRepeatedViolations: true,
      trustForwardedFor,
    }),
  );

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
    if (dangerousFilePattern.test(req.path)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Access denied for unsafe file type',
      });
    }
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'none'; script-src 'none'");
    next();
  }, express.static(join(__dirname, '..', 'uploads')));

  // Listen on all interfaces with a fallback if the default port is already in use.
  const preferredPort = Number(process.env.PORT) || 3000;
  let port = preferredPort;

  try {
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;
    if (listenError.code === 'EADDRINUSE') {
      port = preferredPort + 1;
      logger.warn(`Port ${preferredPort} is in use. Falling back to port ${port}.`);
      await app.listen(port, '0.0.0.0');
    } else {
      throw error;
    }
  }

  // Tight timeouts reduce socket exhaustion and slowloris-style behavior.
  const httpServer = app.getHttpServer() as Server;
  httpServer.requestTimeout = 15_000;
  httpServer.headersTimeout = 10_000;
  httpServer.keepAliveTimeout = 5_000;

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