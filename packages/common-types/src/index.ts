// Shared TypeScript Interfaces for Pak Commerce

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
export type UserRole = 'SUPER_ADMIN' | 'MERCHANT_ADMIN' | 'STORE_MANAGER' | 'STAFF';

export type OrderStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RTO'; // Return to Origin

export type PaymentMethod = 'COD' | 'IBFT' | 'RAAST' | 'JAZZCASH' | 'EASYPAISA' | 'CARD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type LanguageCode = 'en' | 'ur' | 'roman_ur';

export interface PakistaniCity {
  id: string;
  nameEn: string;
  nameUr: string;
  province: 'Punjab' | 'Sindh' | 'KPK' | 'Balochistan' | 'Islamabad' | 'AJK' | 'GB';
  tier: 1 | 2 | 3;
}

export interface OrderItemPayload {
  variantId: string;
  title: string;
  quantity: number;
  price: number; // In PKR
}

export interface CreateOrderDto {
  tenantId: string;
  customerName: string;
  customerPhone: string; // 03XX-XXXXXXX format
  customerEmail?: string;
  shippingCity: string;
  shippingAddress: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: OrderItemPayload[];
}
