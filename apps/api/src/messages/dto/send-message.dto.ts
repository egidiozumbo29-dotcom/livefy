import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class SendMessageDto {
  @IsString()
  receiverId!: string;

  @ValidateIf((o: SendMessageDto) => !o.mediaUrl?.trim())
  @IsString()
  @MaxLength(4000)
  content = "";

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1200)
  mediaUrl?: string;

  @IsOptional()
  @IsIn(["image", "video", "file"])
  mediaType?: "image" | "video" | "file";
}
