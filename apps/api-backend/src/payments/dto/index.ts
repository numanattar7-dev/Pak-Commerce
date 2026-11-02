import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PHONE_REGEX = /^03\d{9}$/;

// Base proof-of-ownership for public payment endpoints — same model as tracking/OTP:
// subdomain scopes the tenant, orderNumber + phone prove the requester's identity.
export class PublicPaymentBaseDto {
  @IsString()
  @MinLength(2)
  subdomain: string;

  @IsString()
  @MinLength(3)
  orderNumber: string;

  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Pakistani mobile number (03XXXXXXXXX)',
  })
  phone: string;
}

export class InitiatePaymentDto extends PublicPaymentBaseDto {}

export class SimulatePaymentDto extends PublicPaymentBaseDto {
  @IsOptional()
  @IsIn(['SUCCESS', 'FAILED'])
  outcome?: 'SUCCESS' | 'FAILED';
}

export class SubmitBankProofDto extends PublicPaymentBaseDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  gatewayTxRef: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  bankName: string;

  @IsString()
  @MinLength(4)
  @MaxLength(64)
  transactionRef: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptImageUrl?: string;
}

export const INTEGRATION_PROVIDERS = [
  'JAZZCASH',
  'EASYPAISA',
  'TCS',
  'LEOPARDS',
  'POSTEX',
  'TRAX',
  'TWILIO',
  'FBR',
  'IBFT',
  'RAAST',
] as const;

export class UpsertIntegrationDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  sandbox?: boolean;
}

export class RejectPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsIn(['INITIATED', 'AWAITING_PROOF', 'SUCCEEDED', 'FAILED'])
  status?: string;

  @IsOptional()
  @IsIn(['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'])
  method?: string;

  @IsOptional()
  @IsString()
  orderId?: string;
}
