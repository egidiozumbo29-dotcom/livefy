import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class StreamIdDto {
  @IsString()
  @MaxLength(64)
  streamId!: string;
}

export class PrivateStartDto extends StreamIdDto {
  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;
}

export class PrivateRequestDto extends StreamIdDto {
  @IsOptional()
  @IsBoolean()
  exclusive?: boolean;
}
