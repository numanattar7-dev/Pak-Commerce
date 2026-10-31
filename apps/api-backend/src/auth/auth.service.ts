import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if tenant subdomain already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.storeSubdomain },
    });
    if (existingTenant) {
      throw new ConflictException('Store subdomain already taken');
    }

    // Email check will be done after tenant creation in transaction

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create tenant + user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.storeName,
          subdomain: dto.storeSubdomain,
          currency: 'PKR',
          status: 'TRIAL',
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          role: 'MERCHANT_ADMIN',
        },
      });

      return { tenant, user };
    });

    const payload = {
      sub: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
    };
    const token = await this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
      },
    };
  }

  async login(dto: LoginDto) {
    // Find user by email (not unique by itself, but we'll return first match)
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };
    const token = await this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            subdomain: tenant.subdomain,
          }
        : null,
    };
  }
}
