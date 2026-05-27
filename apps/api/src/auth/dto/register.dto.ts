import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  country?: string;

  /** Conferma esplicita maggiore età (obbligatoria server-side). */
  @IsBoolean()
  @Equals(true)
  ageConfirmed!: boolean;

  @IsOptional()
  @IsString()
  language?: string;
}
