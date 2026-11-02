import { IsArray, IsIn, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export const WEBHOOK_EVENTS = [
  'order.created',
  'order.status_changed',
  'order.fulfilled',
  'order.shipped',
  'order.refunded',
  'payment.succeeded',
  'payment.failed',
  'webhook.test',
] as const;

export class CreateWebhookDto {
  @IsString()
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  status?: 'ACTIVE' | 'PAUSED';
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENTS as unknown as string[], { each: true })
  events?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  status?: 'ACTIVE' | 'PAUSED';
}
