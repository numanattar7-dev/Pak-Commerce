import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  IsEmail,
  IsBoolean,
  IsInt,
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

  // Only the CODE travels from the client — value/amount are computed server-side
  @IsString()
  @IsOptional()
  discountCode?: string;
}

export class VerifyOtpDto {
  @IsString()
  orderId: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otpCode: string;
}

// Customer-side (public) COD OTP — scoped by order number + phone, the same
// ownership model as public order tracking
export class PublicVerifyOtpDto {
  @IsString()
  subdomain: string;

  @IsString()
  orderNumber: string;

  @Matches(/^03\d{9}$/, { message: 'Phone must be 11 digits starting with 03' })
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otpCode: string;
}

export class PublicResendOtpDto {
  @IsString()
  subdomain: string;

  @IsString()
  orderNumber: string;

  @Matches(/^03\d{9}$/, { message: 'Phone must be 11 digits starting with 03' })
  phone: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'VERIFIED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RTO'])
  status: 'PENDING' | 'VERIFIED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED' | 'RTO';
}

export class FulfillmentItemDto {
  @IsString()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateFulfillmentDto {
  // Omit = fulfill ALL remaining quantities (1-click fulfill)
  @IsArray()
  @IsOptional()
  items?: FulfillmentItemDto[];

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  carrier?: string; // e.g. "TCS", "Leopards" — Pak couriers plug in Phase 4
}

export class CreateRefundDto {
  // Omit = full refund of order total
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  // Only when returned goods re-enter inventory (default false — money-only refund)
  @IsBoolean()
  @IsOptional()
  restock?: boolean;
}