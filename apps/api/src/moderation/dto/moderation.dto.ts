import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class AddModeratorDto {
  @IsString()
  @MaxLength(80)
  username!: string;
}

export class AddWordFilterDto {
  @IsString()
  @MaxLength(80)
  phrase!: string;
}

export class ModerateUserDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24 * 30)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateReportDto {
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  streamId?: string;

  @IsString()
  @MaxLength(80)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class PatchReportDto {
  @IsIn(["OPEN", "REVIEWING", "RESOLVED", "REJECTED"])
  status!: "OPEN" | "REVIEWING" | "RESOLVED" | "REJECTED";
}

export class StreamControlDto {
  @IsIn(["CLOSE_CHAT", "OPEN_CHAT", "END_STREAM"])
  action!: "CLOSE_CHAT" | "OPEN_CHAT" | "END_STREAM";
}
