import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  IsEmail,
  Matches,
  Min,
} from 'class-validator';

export class OrderItemDto {
  @IsString()
  variantId: string;

  @IsString()
  @IsOptional()
  title?: string; // informational only — server uses variant title from DB

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number; // informational only — server enforces price from DB
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  subdomain?: string;

  @IsString()
  customerName: string;

  @Matches(/^03\d{9}$/, { message: 'Phone must be 11 digits starting with 03' })
  customerPhone: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  shippingCity: string;

  @IsString()
  @IsString()
  shippingAddress: string;

  @IsEnum(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'])
  paymentMethod: 'COD' | 'IBFT' | 'RAAST' | 'JAZZCASH' | 'EASYPAISA';

  @IsArray()
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class VerifyOtpDto {
  @IsString()
  orderId: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otpCode: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'VERIFIED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RTO'])
  status: 'PENDING' | 'VERIFIED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' | 'RTO';
}