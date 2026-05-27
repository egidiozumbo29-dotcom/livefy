import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePayoutDto {
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  destination?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
