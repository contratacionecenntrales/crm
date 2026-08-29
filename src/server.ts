import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Extra hosts the client talks to directly, beyond our own origin: the
// Supabase project (auth/db/storage REST + realtime websocket) and the
// Google Fonts stylesheet. SUPABASE_URL is read at request time so this
// works against any project (Lovable Cloud or self-hosted Supabase).
function supabaseConnectSrc(): string {
  const url = process.env["SUPABASE_URL"];
  const origins = new Set(["https://*.supabase.co", "https://*.lovable.cloud"]);
  const wsOrigins = new Set(["wss://*.supabase.co", "wss://*.lovable.cloud"]);
  if (url) {
    try {
      const origin = new URL(url).origin;
      origins.add(origin);
      wsOrigins.add(origin.replace(/^https:/, "wss:"));
    } catch {
      // ignore malformed SUPABASE_URL, fall back to the wildcard hosts above
    }
  }
  return [...origins, ...wsOrigins].join(" ");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// TanStack Start's SSR shell emits a few inline <script> tags (hydration /
// streaming markers) with no fixed content we can hash, so a strict CSP
// needs a per-response nonce rather than 'unsafe-inline'. HTML responses are
// buffered once to stamp every <script> with the same nonce that goes in the
// header; non-HTML responses (JS/CSS/images) pass through untouched.
async function withSecurityHeaders(response: Response): Promise<Response> {
  const nonce = randomNonce();
  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  const headers = new Headers(response.headers);
  let body: BodyInit | null = response.body;

  if (isHtml) {
    const html = await response.text();
    body = html.replace(/<script(?=[\s>])/g, `<script nonce="${nonce}"`);
    headers.delete("content-length");
  }

  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${supabaseConnectSrc()}`,
    ].join("; "),
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
