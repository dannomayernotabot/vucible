// Thin pass-through proxy for OpenAI's API.
// Why this exists: OpenAI's error responses (401, 429, 5xx) do NOT include
// `access-control-allow-origin` headers — only the OPTIONS preflight does.
// Browsers block the response, surfacing a CORS error instead of the real
// auth/rate failure. Direct browser-origin calls are therefore unviable for
// the wizard validation flow. We proxy server-side so the response is
// same-origin and headers are normalized via this Edge handler.
//
// Security model: BYOK is preserved. The user's Authorization header is
// passed through verbatim — we never persist or read the key. Cookies
// from upstream (Cloudflare bot tokens, etc.) are stripped on the way back
// so they don't leak through to the client.
//
// Open-proxy mitigation: in v1 there's no Origin allow-list. If abuse
// surfaces, lock down to ALLOWED_ORIGINS env var.

export const runtime = "edge";

const OPENAI_BASE = "https://api.openai.com";

// Headers we strip from the request before forwarding upstream.
const STRIP_REQ_HEADERS = ["host", "origin", "referer", "x-forwarded-for", "x-vercel-id", "x-vercel-deployment-url", "cookie"];

// Headers we strip from the upstream response before returning to the browser.
// `set-cookie` removed for security (Cloudflare cf_bm tokens shouldn't leak to UI).
const STRIP_RES_HEADERS = ["set-cookie"];

async function proxy(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `${OPENAI_BASE}/${path.join("/")}${url.search}`;

  const headers = new Headers(req.headers);
  for (const h of STRIP_REQ_HEADERS) headers.delete(h);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    // duplex required for streaming request body in edge runtime
    ...(req.body && { duplex: "half" }),
    redirect: "manual",
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return new Response(JSON.stringify({ error: { message, type: "proxy_network_error" } }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const respHeaders = new Headers(upstream.headers);
  for (const h of STRIP_RES_HEADERS) respHeaders.delete(h);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as HEAD, handler as OPTIONS };
