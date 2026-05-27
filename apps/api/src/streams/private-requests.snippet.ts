  // ---------- Richieste show privato (viewer -> streamer) ----------

  private static REQUEST_TTL_MS = 90_000;

  async createPrivateRequest(viewerId: string, streamId: string) {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      select: {
        id: true,
        userId: true,
        status: true,
        privatePricePerMinute: true,
      },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new NotFoundException("live_offline");
    }
    if (stream.userId === viewerId) {
      throw new BadRequestException("sei_la_streamer");
    }
    const price = stream.privatePricePerMinute > 0 ? stream.privatePricePerMinute : 0;

    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { balance: true },
    });
    if (!viewer) throw new NotFoundException("viewer_non_trovato");
    if (price > 0 && Number(viewer.balance) < price) {
      throw new HttpException({ message: "balance_insufficiente" }, HttpStatus.PAYMENT_REQUIRED);
    }

    // niente duplicati pending dello stesso viewer sullo stesso stream
    const existing = await this.prisma.privateRequest.findFirst({
      where: { streamId: stream.id, viewerId, status: "PENDING" },
    });
    if (existing) {
      return { id: existing.id, status: existing.status, expiresAt: existing.expiresAt };
    }

    const expiresAt = new Date(Date.now() + StreamsService.REQUEST_TTL_MS);
    const created = await this.prisma.privateRequest.create({
      data: {
        streamId: stream.id,
        viewerId,
        creatorId: stream.userId,
        tokensPerMinute: price,
        expiresAt,
      },
    });
    return { id: created.id, status: created.status, expiresAt: created.expiresAt };
  }

  async listPrivateRequestsForCreator(creatorId: string) {
    await this.expireStalePrivateRequests();
    const rows = await this.prisma.privateRequest.findMany({
      where: { creatorId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        viewer: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      streamId: r.streamId,
      tokensPerMinute: r.tokensPerMinute,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      viewer: r.viewer,
    }));
  }

  async listMyPrivateRequests(viewerId: string) {
    await this.expireStalePrivateRequests();
    const rows = await this.prisma.privateRequest.findMany({
      where: { viewerId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      streamId: r.streamId,
      tokensPerMinute: r.tokensPerMinute,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      respondedAt: r.respondedAt,
      rejectionReason: r.rejectionReason,
    }));
  }

  async cancelPrivateRequest(viewerId: string, requestId: string) {
    const r = await this.prisma.privateRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFoundException("richiesta_non_trovata");
    if (r.viewerId !== viewerId) throw new ForbiddenException("non_autorizzato");
    if (r.status !== "PENDING") return { ok: true, status: r.status };
    await this.prisma.privateRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    return { ok: true, status: "CANCELLED" };
  }

  async acceptPrivateRequest(creatorId: string, requestId: string) {
    const req = await this.prisma.privateRequest.findUnique({
      where: { id: requestId },
      include: { stream: { select: { id: true, status: true, userId: true } } },
    });
    if (!req) throw new NotFoundException("richiesta_non_trovata");
    if (req.creatorId !== creatorId) throw new ForbiddenException("non_autorizzato");
    if (req.status !== "PENDING") throw new ConflictException("richiesta_non_pending");
    if (new Date(req.expiresAt) < new Date()) {
      await this.prisma.privateRequest.update({
        where: { id: req.id },
        data: { status: "EXPIRED", respondedAt: new Date() },
      });
      throw new ConflictException("richiesta_scaduta");
    }
    if (!req.stream || req.stream.status !== "LIVE") {
      throw new ConflictException("live_offline");
    }

    // 1) marca accepted; 2) imposta stream in PRIVATE con price minuto = offerta;
    // 3) altre richieste pending dello stesso stream -> REJECTED auto
    await this.prisma.$transaction([
      this.prisma.privateRequest.update({
        where: { id: req.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      }),
      this.prisma.privateRequest.updateMany({
        where: { streamId: req.streamId, status: "PENDING", NOT: { id: req.id } },
        data: { status: "REJECTED", respondedAt: new Date(), rejectionReason: "altra_richiesta_accettata" },
      }),
      this.prisma.stream.update({
        where: { id: req.streamId },
        data: {
          showMode: ShowMode.PRIVATE,
          privatePricePerMinute: req.tokensPerMinute,
        },
      }),
    ]);

    if (req.stream.userId) {
      try { await this.chat.broadcastLiveState(`live-${req.stream.userId}`); } catch { /* best effort */ }
    }

    return { ok: true, requestId: req.id, streamId: req.streamId };
  }

  async rejectPrivateRequest(creatorId: string, requestId: string, reason?: string) {
    const r = await this.prisma.privateRequest.findUnique({ where: { id: requestId } });
    if (!r) throw new NotFoundException("richiesta_non_trovata");
    if (r.creatorId !== creatorId) throw new ForbiddenException("non_autorizzato");
    if (r.status !== "PENDING") throw new ConflictException("richiesta_non_pending");
    await this.prisma.privateRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
        rejectionReason: reason?.slice(0, 200) ?? null,
      },
    });
    return { ok: true, status: "REJECTED" };
  }

  private async expireStalePrivateRequests(): Promise<void> {
    try {
      await this.prisma.privateRequest.updateMany({
        where: { status: "PENDING", expiresAt: { lt: new Date() } },
        data: { status: "EXPIRED", respondedAt: new Date() },
      });
    } catch {
      /* best effort */
    }
  }
