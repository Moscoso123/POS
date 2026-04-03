import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/auth.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private logger = new Logger('JwtStrategy');
  
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const secret = configService.get('JWT_SECRET') || 'your-super-secret-key-change-this-in-production-min-32-chars';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    this.logger.log(`🔐 JwtStrategy initialized with secret from: ${configService.get('JWT_SECRET') ? 'ENV' : 'DEFAULT'}`);
  }

  async validate(payload: any) {
    this.logger.debug('🔑 Validating JWT payload for user:', payload.sub);
    
    const user = await this.userRepository.findOne({
      where: { id: payload.sub }
    });
    
    if (!user) {
      this.logger.warn(`❌ User not found for ID: ${payload.sub}`);
      throw new UnauthorizedException('User not found');
    }
    
    this.logger.debug(`✅ User validated: ${user.name} (${user.userType})`);
    
    return {
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType,
      name: payload.name
    };
  }
}