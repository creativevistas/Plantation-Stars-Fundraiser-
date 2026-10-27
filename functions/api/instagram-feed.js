// Cloudflare Pages: read-only Instagram feed. Access token stays in an encrypted secret.
const ENDPOINT = "https://graph.instagram.com/v25.0/me/media";
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";
const BASIC_FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";

function validHttps(value) {
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
}
function instagramLink(value) {
  const u = validHttps(value);
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "instagram.com" || host === "www.instagram.com" ? u : "";
  } catch { return ""; }
}
async function mediaRequest(token, fields) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "18");
  return fetch(url.toString(), {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
}
export async function onRequestGet(context) {
  const env = context.env || {};
  // Safe troubleshooting: publish boolean binding presence only; never expose values.
  if (new URL(context.request.url).searchParams.get("check") === "1") {
    return Response.json({
      diagnostic: true,
      instagramSecretFound: typeof env.INSTAGRAM_ACCESS_TOKEN === "string" && env.INSTAGRAM_ACCESS_TOKEN.trim().length > 0,
      stripeSecretFound: typeof env.STRIPE_SECRET_KEY === "string" && env.STRIPE_SECRET_KEY.trim().length > 0,
      databaseBindingFound: Boolean(env.DB)
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return Response.json({ ok: false, error: "Instagram connection not configured." }, {
    status: 503, headers: { "Cache-Control": "no-store" }
  });
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/instagram-feed?v=1", context.request.url));
  try {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  } catch (_) { /* cache is optional */ }

  try {
    let res = await mediaRequest(token, FIELDS);
    if (!res.ok) res = await mediaRequest(token, BASIC_FIELDS); // older API permissions may not expose carousel children
    if (!res.ok) {
      console.error("Instagram API status", res.status);
      return Response.json({ ok: false, error: "Instagram feed temporarily unavailable." }, {
        status: 502, headers: { "Cache-Control": "no-store" }
      });
    }
    const result = await res.json();
    const posts = [];
    for (const m of Array.isArray(result.data) ? result.data : []) {
      const child = Array.isArray(m.children?.data) ? m.children.data.find(c => validHttps(c.media_url || c.thumbnail_url)) : null;
      const kind = m.media_type === "VIDEO" ? "VIDEO" : m.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" : "IMAGE";
      const thumbnail = validHttps(m.thumbnail_url || (kind === "VIDEO" ? "" : m.media_url) || child?.thumbnail_url || child?.media_url);
      const video = kind === "VIDEO" ? validHttps(m.media_url) : "";
      const permalink = instagramLink(m.permalink);
      if (!permalink || (!thumbnail && !video)) continue;
      posts.push({
        id: String(m.id || ""),
        type: kind, thumbnail, video, permalink,
        caption: String(m.caption || "").slice(0, 2200),
        timestamp: String(m.timestamp || "")
      });
      if (posts.length >= 12) break;
    }
    if (!posts.length) return Response.json({ ok: false, error: "Instagram posts not available." }, {
      status: 502, headers: { "Cache-Control": "no-store" }
    });
    const response = Response.json({ ok: true, posts }, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=600", "X-Content-Type-Options": "nosniff" }
    });
    context.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    return response;
  } catch (err) {
    console.error("Instagram feed request failed");
    return Response.json({ ok: false, error: "Instagram feed temporarily unavailable." }, {
      status: 502, headers: { "Cache-Control": "no-store" }
    });
  }
}
