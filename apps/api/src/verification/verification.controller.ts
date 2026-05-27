import {
  Controller,
  Get,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { AuthedRequest } from "../common/types/request-user";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VerificationService } from "./verification.service";

@Controller("verification")
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get("streamer/me")
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: AuthedRequest) {
    return this.verification.getStreamerVerificationStatus(req.user.userId);
  }

  @Post("streamer")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "idDocument", maxCount: 1 },
        { name: "selfieWithId", maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  submit(
    @Req() req: AuthedRequest,
    @UploadedFiles()
    files: {
      idDocument?: Express.Multer.File[];
      selfieWithId?: Express.Multer.File[];
    },
  ) {
    return this.verification.submitStreamerDocuments(req.user.userId, files);
  }
}
