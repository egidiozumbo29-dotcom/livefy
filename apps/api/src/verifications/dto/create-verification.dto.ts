import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class CreateVerificationDto {
  @IsString()
  @IsNotEmpty()
  idDocumentPath: string;

  @IsString()
  @IsNotEmpty()
  selfieWithIdPath: string;

  @IsString()
  @IsOptional()
  realName?: string;

  @IsString()
  @IsOptional()
  realAddress?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  taxId?: string;
}
