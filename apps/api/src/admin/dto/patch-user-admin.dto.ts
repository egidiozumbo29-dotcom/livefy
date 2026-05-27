import { Role } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class PatchUserAdminDto {
  @IsOptional()
  @IsBoolean()
  banned?: boolean;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
