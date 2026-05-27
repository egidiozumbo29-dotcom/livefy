import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { TOKEN_PACKS } from "../token-packs.catalog";

const KEYS = TOKEN_PACKS.map((p) => p.key) as [string, ...string[]];

export class CryptoIntentDto {
  @IsString()
  @IsIn(KEYS)
  packKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  network?: string;
}
