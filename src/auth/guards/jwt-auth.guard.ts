import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private logger = new Logger('JwtAuthGuard');

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    
    if (authHeader) {
      this.logger.debug(`🔐 Auth header present: ${authHeader.substring(0, 30)}...`);
    } else {
      this.logger.warn('⚠️ No authorization header found in request');
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err) {
      this.logger.error(`❌ JWT Guard Error: ${err.message}`);
      throw err;
    }
    
    if (!user) {
      this.logger.warn(`⚠️ No user extracted from JWT. Info: ${JSON.stringify(info)}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
    
    this.logger.debug(`✅ User authenticated: ${user.email || user.userId}`);
    return user;
  }
}