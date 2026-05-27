import { redirect } from "next/navigation";
import { createMagicLink, isEmailAllowed } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mailer";

async function requestLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !isEmailAllowed(email)) {
    redirect("/login?err=not_allowed");
  }
  const link = await createMagicLink(email);
  await sendMagicLinkEmail(email, link);
  redirect("/login?sent=1");
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { sent?: string; err?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <h1 className="text-2xl font-bold">Owner Hub</h1>
        <p className="mt-1 text-sm text-muted">
          Login con magic link. Solo email autorizzate.
        </p>

        {searchParams?.sent === "1" ? (
          <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm text-emerald-200">
            Link inviato. Controlla la tua email (o la console in dev) entro
            15 minuti.
          </p>
        ) : null}

        {searchParams?.err === "not_allowed" ? (
          <p className="mt-6 rounded-md border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">
            Email non autorizzata.
          </p>
        ) : null}

        <form action={requestLink} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-2 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-bold text-black hover:opacity-90"
          >
            Invia magic link
          </button>
        </form>
      </div>
    </main>
  );
}
