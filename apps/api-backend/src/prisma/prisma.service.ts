import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  async onModuleInit() {
    // Neon free tier suspends idle computes; cold starts can drop the first
    // connection — retry a few times before giving up
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.$connect();
        console.log('[Prisma] Database connected');
        return;
      } catch (e: any) {
        console.error(
          `[Prisma] Connection attempt ${attempt}/5 failed: ${e?.message || e}`,
        );
        if (attempt === 5) throw e;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
