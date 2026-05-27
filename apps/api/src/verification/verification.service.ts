import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_ID_MIME = new Set([...ALLOWED_IMAGE, "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(m: string): string {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/heic" || m === "image/heif") return "heic";
  if (m === "application/pdf") return "pdf";
  return "bin";
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async submitStreamerDocuments(
    userId: string,
    files: {
      idDocument?: Express.Multer.File[];
      selfieWithId?: Express.Multer.File[];
    },
  ) {
    const idDoc = files.idDocument?.[0];
    const selfie = files.selfieWithId?.[0];
    if (!idDoc || !selfie) {
      throw new BadRequestException("documenti_obbligatori");
    }
    if (idDoc.size > MAX_BYTES || selfie.size > MAX_BYTES) {
      throw new BadRequestException("file_troppo_grande");
    }
    const idMime = idDoc.mimetype.toLowerCase();
    const selfMime = selfie.mimetype.toLowerCase();
    if (!ALLOWED_ID_MIME.has(idMime) || !ALLOWED_IMAGE.has(selfMime)) {
      throw new BadRequestException("formato_file_non_valido");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.role === Role.MODEL || user.role === Role.ADMIN) {
      throw new BadRequestException("gia_streamer");
    }
    if (user.role !== Role.VIEWER) {
      throw new BadRequestException("ruolo_non_eleggibile");
    }

    const kycRoot = path.join(process.cwd(), "uploads", "kyc", userId);
    fs.mkdirSync(kycRoot, { recursive: true });

    const ts = Date.now();
    const idName = `id-${ts}.${extFromMime(idMime)}`;
    const selfieName = `selfie-${ts}.${extFromMime(selfMime)}`;
    const idPath = path.join(kycRoot, idName);
    const selfiePath = path.join(kycRoot, selfieName);

    const existing = await this.prisma.streamerVerification.findUnique({
      where: { userId },
    });
    if (existing) {
      for (const p of [existing.idDocumentPath, existing.selfieWithIdPath]) {
        try {
          fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }

    fs.writeFileSync(idPath, idDoc.buffer);
    fs.writeFileSync(selfiePath, selfie.buffer);

    await this.prisma.$transaction([
      this.prisma.streamerVerification.upsert({
        where: { userId },
        create: {
          userId,
          idDocumentPath: idPath,
          selfieWithIdPath: selfiePath,
        },
        update: {
          idDocumentPath: idPath,
          selfieWithIdPath: selfiePath,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { role: Role.MODEL },
      }),
    ]);

    return this.auth.getAuthBundleForUserId(userId);
  }

  async getStreamerVerificationStatus(userId: string) {
    const row = await this.prisma.streamerVerification.findUnique({
      where: { userId },
      select: { createdAt: true },
    });
    return { submitted: !!row, submittedAt: row?.createdAt.toISOString() ?? null };
  }
}
