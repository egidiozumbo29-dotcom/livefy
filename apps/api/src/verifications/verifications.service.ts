import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { VerificationStatus } from "@prisma/client";
import type { CreateVerificationDto } from "./dto/create-verification.dto";

@Injectable()
export class VerificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateVerificationDto) {
    const existing = await this.prisma.streamerVerification.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === VerificationStatus.PENDING) {
        throw new BadRequestException("verification_already_pending");
      }
      if (existing.status === VerificationStatus.APPROVED) {
        throw new BadRequestException("already_verified");
      }
    }

    const verification = await this.prisma.streamerVerification.upsert({
      where: { userId },
      update: {
        idDocumentPath: dto.idDocumentPath,
        selfieWithIdPath: dto.selfieWithIdPath,
        realName: dto.realName,
        realAddress: dto.realAddress,
        phoneNumber: dto.phoneNumber,
        taxId: dto.taxId,
        status: VerificationStatus.PENDING,
        rejectionReason: null,
      },
      create: {
        userId,
        idDocumentPath: dto.idDocumentPath,
        selfieWithIdPath: dto.selfieWithIdPath,
        realName: dto.realName,
        realAddress: dto.realAddress,
        phoneNumber: dto.phoneNumber,
        taxId: dto.taxId,
        status: VerificationStatus.PENDING,
      },
    });

    return verification;
  }

  async getMyStatus(userId: string) {
    const verification = await this.prisma.streamerVerification.findUnique({
      where: { userId },
    });

    if (!verification) {
      return { status: "NOT_SUBMITTED" };
    }

    return {
      status: verification.status,
      rejectionReason: verification.rejectionReason,
      createdAt: verification.createdAt,
      approvedAt: verification.approvedAt,
    };
  }

  async listPending() {
    return this.prisma.streamerVerification.findMany({
      where: { status: VerificationStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async approve(id: string, adminUserId: string) {
    const verification = await this.prisma.streamerVerification.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      await tx.streamerVerification.update({
        where: { id },
        data: {
          status: VerificationStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: adminUserId,
        },
      });

      await tx.user.update({
        where: { id: verification.userId },
        data: { role: "MODEL" },
      });
    });

    return { success: true };
  }

  async reject(id: string, reason: string) {
    const verification = await this.prisma.streamerVerification.findUnique({
      where: { id },
    });

    if (!verification) throw new NotFoundException();

    await this.prisma.streamerVerification.update({
      where: { id },
      data: {
        status: VerificationStatus.REJECTED,
        rejectionReason: reason,
      },
    });

    return { success: true };
  }
}
