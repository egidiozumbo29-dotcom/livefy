import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class TipMenuItemDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsInt()
  @Min(1)
  @Max(500_000)
  tokenCost!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReplaceTipMenuDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => TipMenuItemDto)
  items!: TipMenuItemDto[];
}
