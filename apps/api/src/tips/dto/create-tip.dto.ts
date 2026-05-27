import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateTipDto {
  @IsString()
  receiverId!: string;

  @IsInt()
  @Min(1)
  @Max(500_000)
  amount!: number;

  @IsOptional()
  @IsString()
  streamId?: string;
}
