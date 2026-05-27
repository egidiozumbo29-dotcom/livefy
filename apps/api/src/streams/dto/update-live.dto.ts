import { ShowMode } from "@prisma/client";
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Modifica configurazione di una live in corso senza terminarla. */
export class UpdateLiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  /** Nuova password (min 4) o lasciare vuoto con `clearRoomPassword` per rimuovere. */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  roomPassword?: string;

  @IsOptional()
  @IsBoolean()
  clearRoomPassword?: boolean;

  @IsOptional()
  @IsEnum(ShowMode)
  showMode?: ShowMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  basePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  privatePricePerMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  spyPricePerMinute?: number;

  @IsOptional()
  @IsBoolean()
  chatOpen?: boolean;
}
