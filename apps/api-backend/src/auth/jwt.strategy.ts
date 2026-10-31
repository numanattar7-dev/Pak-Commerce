import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'pak-commerce-secret',
    });
  }

  async validate(payload: any) {
    console.log('[JWT Strategy] Validating token, payload:', payload);
    try {
      // Fetch user with tenant
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub },
        include: {
          tenant: true,
        },
      });

      console.log('[JWT Strategy] Found user:', user?.id);

      if (!user) {
        console.log('[JWT Strategy] User not found for id:', payload.sub);
        return { id: payload.sub, tenantId: payload.tenantId, role: payload.role, tenant: null };
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      };
    } catch (e) {
      console.log('[JWT Strategy] Error:', e.message);
      return null;
    }
  }
}
