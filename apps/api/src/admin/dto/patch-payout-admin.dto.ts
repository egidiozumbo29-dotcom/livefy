import { PayoutStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

/** Solo transizioni operative da parte dell’admin (non si creano payout da qui). */
export class PatchPayoutAdminDto {
  @IsEnum(PayoutStatus)
  status!: PayoutStatus;
}
