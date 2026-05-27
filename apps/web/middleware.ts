import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/** Lingua automatica da Accept-Language + cookie (vedi doc next-intl routing). */
export default createMiddleware(routing);

export const config = {
  /** Esclude `/_nestjs` (rewrite verso Nest), `api` e asset. */
  matcher: ["/((?!api|_nestjs|_next|_vercel|.*\\..*).*)"],
};
