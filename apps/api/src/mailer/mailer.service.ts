import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    if (!host) {
      this.logger.warn("SMTP_HOST non configurato — le email vengono stampate in console.");
      return;
    }
    const port = Number(this.config.get<string>("SMTP_PORT") ?? 587);
    const user = this.config.get<string>("SMTP_USER")?.trim();
    const pass = this.config.get<string>("SMTP_PASS")?.trim();

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private from(): string {
    const f = this.config.get<string>("SMTP_FROM")?.trim();
    const user = this.config.get<string>("SMTP_USER")?.trim();
    return f ?? `Livefy <${user ?? "noreply@livefy.app"}>`;
  }

  async sendPayoutStatusEmail(opts: {
    to: string;
    username: string;
    status: "APPROVED" | "PAID" | "REJECTED";
    amountTokens: number;
    amountEurNet?: number;
    note?: string | null;
  }): Promise<void> {
    const { to, username, status, amountTokens, amountEurNet, note } = opts;

    const statusLabel: Record<typeof status, string> = {
      APPROVED: "Approvato",
      PAID: "Pagato",
      REJECTED: "Rifiutato",
    };

    const statusColor: Record<typeof status, string> = {
      APPROVED: "#16a34a",
      PAID: "#2563eb",
      REJECTED: "#dc2626",
    };

    const bodyLines: string[] = [];
    if (status === "APPROVED") {
      bodyLines.push(`La tua richiesta di prelievo di <strong>${amountTokens} token</strong> è stata approvata.`);
      bodyLines.push("Il pagamento sarà elaborato a breve.");
    } else if (status === "PAID") {
      const eurStr = amountEurNet != null ? ` (≈ €${amountEurNet.toFixed(2)} netti)` : "";
      bodyLines.push(`La tua richiesta di prelievo di <strong>${amountTokens} token${eurStr}</strong> è stata pagata.`);
      bodyLines.push("Controlla il tuo conto nelle prossime ore.");
    } else {
      bodyLines.push(`La tua richiesta di prelievo di <strong>${amountTokens} token</strong> è stata rifiutata.`);
      bodyLines.push("I token sono stati riacreditati sul tuo saldo creator.");
      if (note) bodyLines.push(`Nota: <em>${note}</em>`);
    }

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">
        <h2 style="margin:0 0 4px">Prelievo ${statusLabel[status]}</h2>
        <p style="margin:0 0 16px;color:#888;font-size:13px">Ciao ${username},</p>
        ${bodyLines.map((l) => `<p style="color:#333;line-height:1.6">${l}</p>`).join("")}
        <div style="margin:24px 0;padding:12px 16px;border-radius:8px;background:#f5f5f5;font-size:13px;color:#555">
          Stato: <strong style="color:${statusColor[status]}">${statusLabel[status]}</strong>
        </div>
        <p style="color:#aaa;font-size:12px;margin-top:24px">
          Puoi consultare i tuoi prelievi in qualsiasi momento nel tuo portafoglio Livefy.
        </p>
      </div>
    `;

    const subject = `Prelievo ${statusLabel[status]} — Livefy`;
    const text = bodyLines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n");

    if (!this.transporter) {
      this.logger.log(`[email] ${subject} → ${to}\n${text}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from(),
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Email payout "${status}" inviata a ${to}`);
    } catch (err) {
      this.logger.error(`Errore invio email payout a ${to}: ${String(err)}`);
    }
  }
}
