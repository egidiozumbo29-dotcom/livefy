import { IsIn, IsString } from "class-validator";
import { TOKEN_PACKS } from "../token-packs.catalog";

const KEYS = TOKEN_PACKS.map((p) => p.key) as [string, ...string[]];

export class CheckoutDto {
  @IsString()
  @IsIn(KEYS)
  packKey!: string;
}
