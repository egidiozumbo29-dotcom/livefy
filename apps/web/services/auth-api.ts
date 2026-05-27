import type { AuthUser } from "@/store/slices/authSlice";
import { apiFetch, fetchWithTimeout, getApiBaseUrl } from "./api";

export type AuthResponse = {
  access_token: string;
  user: AuthUser;
};

function mapAuthUser(raw: unknown): AuthUser {
  if (!raw || typeof raw !== "object") {
    throw new Error("Dati utente mancanti nella risposta.");
  }
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const email = o.email;
  const role = o.role;
  if (typeof id !== "string" || typeof email !== "string" || typeof role !== "string") {
    throw new Error("Dati utente non validi nella risposta.");
  }
  if (role !== "VIEWER" && role !== "MODEL" && role !== "ADMIN" && role !== "MODERATOR") {
    throw new Error("Ruolo utente non riconosciuto.");
  }
  const bal = o.balance;
  const balance =
    typeof bal === "number" && !Number.isNaN(bal)
      ? bal
      : Number(bal ?? 0);
  return {
    id,
    username: typeof o.username === "string" ? o.username : "",
    email,
    role,
    balance: Number.isFinite(balance) ? balance : 0,
    avatarUrl: o.avatarUrl === null || typeof o.avatarUrl === "string" ? o.avatarUrl : null,
  };
}

function parseAuthResponse(data: unknown): AuthResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Risposta del server non valida.");
  }
  const d = data as Record<string, unknown>;
  const token = d.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Token di accesso mancante nella risposta.");
  }
  return { access_token: token, user: mapAuthUser(d.user) };
}

const MSG_MAP: Record<string, string> = {
  credenziali_non_valide: "Email o password non corretti.",
  account_bloccato: "Questo account è stato sospeso.",
  email_o_username_esistente: "Email o username già in uso.",
  eta_non_consentita: "Devi avere almeno 18 anni.",
  birthDate_non_valida: "Data di nascita non valida.",
  documenti_obbligatori: "Carica documento e selfie con documento.",
  file_troppo_grande: "Uno o più file superano 5 MB.",
  formato_file_non_valido: "Formato file non consentito (usa JPEG, PNG, WebP, PDF per il documento; JPEG, PNG o WebP per il selfie).",
  gia_streamer: "Il tuo account è già da streamer.",
  ruolo_non_eleggibile: "Solo gli account viewer possono richiedere questo passaggio.",
};

function parseJsonBody(text: string): unknown {
  if (!text?.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function messageFromBody(data: unknown): string {
  if (!data || typeof data !== "object") return "Richiesta non valida";
  const m = (data as { message?: unknown }).message;
  if (typeof m === "string") return MSG_MAP[m] ?? m;
  if (Array.isArray(m)) return m.map(String).join(", ");
  return "Richiesta non valida";
}

function wrapNetworkError(err: unknown): Error {
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return new Error(
      "Impossibile contattare il server API. Avvia il backend: dalla cartella del progetto esegui `npm run dev:api` (porta 4000) e assicurati che PostgreSQL sia avviato con le migrazioni Prisma applicate.",
    );
  }
  return err instanceof Error ? err : new Error("Errore di rete");
}

export async function loginRequest(
  email: string,
  password: string
): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/auth/login`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const text = await res.text();
  const data = parseJsonBody(text);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Endpoint non trovato (${url}). Verifica che l'API Nest sia in esecuzione e che l'URL base sia corretto.`,
      );
    }
    throw new Error(messageFromBody(data));
  }
  return parseAuthResponse(data);
}

export async function registerRequest(payload: {
  username: string;
  email: string;
  password: string;
  birthDate: string;
  country?: string;
  ageConfirmed: boolean;
  language?: string;
}): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, "")}/auth/register`;
  const body = {
    ...payload,
    username: payload.username.trim(),
    email: payload.email.trim(),
  };
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const text = await res.text();
  const data = parseJsonBody(text);
  if (!res.ok) throw new Error(messageFromBody(data));
  return parseAuthResponse(data);
}

/** Upload documento + selfie; risposta come login con nuovo JWT (ruolo MODEL). */
export async function submitStreamerKyc(
  formData: FormData
): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await apiFetch("/verification/streamer", {
      method: "POST",
      body: formData,
    });
  } catch (e) {
    throw wrapNetworkError(e);
  }
  const text = await res.text();
  const data = parseJsonBody(text);
  if (!res.ok) {
    throw new Error(messageFromBody(data));
  }
  return parseAuthResponse(data);
}
