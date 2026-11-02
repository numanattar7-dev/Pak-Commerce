import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for frontend apps
  // CORS_ORIGINS: comma-separated extra origins (e.g. Vercel preview/staging URLs)
  const extraOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [
      'http://localhost:3000', // Admin Dashboard
      'http://localhost:3001', // Storefront
      /\.pakcommerce\.pk$/,    // Production subdomains
      /\.vercel\.app$/,        // Staging / preview deployments
      ...extraOrigins,         // Custom domains
    ],
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Serve uploaded product images at /uploads/<file>
  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 Pak Commerce API running on http://localhost:${port}`);
}

bootstrap();
