import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export const COURIERS = ['TCS', 'LEOPARDS', 'POSTEX', 'TRAX'] as const;
export type Courier = (typeof COURIERS)[number];

export class CourierRatesDto {
  @IsString()
  city: string;

  @IsInt()
  @Min(100)
  @Max(30_000)
  @IsOptional()
  weightGrams?: number; // parcel weight, default 500g
}

export class BookShipmentDto {
  @IsString()
  orderId: string;

  @IsEnum(COURIERS as unknown as Record<string, string>)
  courier: Courier;
}
