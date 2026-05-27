import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Token viewer LiveKit via POST (password non finisce nei log query string). */
export class ViewerTokenDto {
  @IsString()
  @MinLength(3)
  @MaxLength(256)
  room!: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  roomPassword?: string;
}
