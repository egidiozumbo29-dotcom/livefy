import nodemailer from "nodemailer";

/**
 * Mailer SMTP (es. Gmail con App Password, Postmark, SendGrid).
 * Se SMTP_HOST e' vuoto, in dev stampa il link in console (zero config richiesta).
 */
export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.log(`\n[owner-hub] Magic link per ${to}:\n  ${link}\n`);
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.SMTP_FROM?.trim() ??
    `Owner Hub <${user ?? "noreply@example.com"}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 -> TLS implicito; 587 -> STARTTLS (consigliato per Gmail)
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">
      <h2 style="margin:0 0 12px">Accesso a Owner Hub</h2>
      <p style="color:#444">Clicca il pulsante qui sotto per accedere. Il link e' valido per 15 minuti.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:600">Accedi</a>
      </p>
      <p style="color:#888;font-size:13px">Se il pulsante non funziona, copia questo link nel browser:<br>
      <span style="word-break:break-all">${link}</span></p>
      <p style="color:#aaa;font-size:12px;margin-top:24px">Se non hai richiesto tu questo accesso, ignora il messaggio.</p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: "Owner Hub - il tuo link di accesso",
    text: `Accedi a Owner Hub (valido 15 minuti): ${link}`,
    html,
  });

  console.log(`[owner-hub] magic link inviato via SMTP a ${to}`);
}
