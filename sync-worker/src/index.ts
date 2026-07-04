/**
 * Tectonic profile-sync Worker.
 *
 * Replaces the Supabase `profiles` table (ADR-0020, supersedes ADR-0013 /
 * ADR-0017). Tectonic is a single-user, local-first app: the local profile
 * is the working copy, and this Worker is the one place it is mirrored so it
 * can follow Jonas across devices. There is exactly one user, so there is
 * exactly one KV key.
 *
 * Routes:
 *   GET  /profile  -> the stored JSON blob, or 404 when nothing is stored yet
 *   PUT  /profile  -> store the JSON body as the profile
 *   OPTIONS *      -> CORS preflight
 *
 * Auth is a single bearer secret (`Authorization: Bearer <SYNC_SECRET>`).
 * The secret ships inspectable in the client bundle, which is acceptable
 * here: one user, low stakes, and the worst case is someone reading or
 * overwriting one puzzle-progress blob.
 */

export interface Env {
  /** KV namespace holding the single profile blob. */
  PROFILES: KVNamespace;
  /** Shared bearer secret, set via `wrangler secret put SYNC_SECRET`. */
  SYNC_SECRET: string;
}

/** The sole KV key, one user, one profile. */
const PROFILE_KEY = 'profile';

/**
 * Origins allowed to call the Worker from a browser / WebView:
 *   - the production GitHub Pages site (no custom domain is configured, so
 *     it is the `jhoglund.github.io` Pages origin, see .github/workflows/deploy.yml)
 *   - the Capacitor iOS WebView origins
 *   - local dev over puma-dev (https://tectonic.test) and the Vite dev server
 */
const ALLOWED_ORIGINS = new Set([
  'https://jhoglund.github.io',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://tectonic.test',
  'http://tectonic.test',
  'http://localhost:7576',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    // Echo back only a known origin; empty string when unknown so the
    // browser blocks it. `Vary: Origin` keeps caches per-origin honest.
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(body === null ? '' : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

/** Constant-ish bearer check. Missing or non-matching token -> false. */
function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const token = header.slice(prefix.length);
  return Boolean(env.SYNC_SECRET) && token === env.SYNC_SECRET;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);

    // CORS preflight, answer before auth so the browser can proceed.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname !== '/profile') {
      return json({ error: 'not found' }, 404, origin);
    }

    if (!isAuthorized(request, env)) {
      return json({ error: 'unauthorized' }, 401, origin);
    }

    if (request.method === 'GET') {
      const stored = await env.PROFILES.get(PROFILE_KEY);
      if (stored === null) {
        return json({ error: 'not found' }, 404, origin);
      }
      // Stored as raw JSON text; hand it back verbatim.
      return new Response(stored, {
        status: 200,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    }

    if (request.method === 'PUT') {
      const raw = await request.text();
      // Validate it is JSON before storing, so a GET can always trust it.
      try {
        JSON.parse(raw);
      } catch {
        return json({ error: 'body must be JSON' }, 400, origin);
      }
      await env.PROFILES.put(PROFILE_KEY, raw);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'method not allowed' }, 405, origin);
  },
};
