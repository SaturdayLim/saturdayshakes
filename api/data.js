// Vercel serverless function — shared cross-device store for the Cocktail Compendium.
// No npm dependencies: talks to Upstash Redis over its REST API with global fetch.
//
// Required environment variables (set in Vercel → Project → Settings → Environment Variables):
//   KV_REST_API_URL    or  UPSTASH_REDIS_REST_URL     (set automatically by the Upstash integration)
//   KV_REST_API_TOKEN  or  UPSTASH_REDIS_REST_TOKEN
//   APP_PASSWORD       a secret you choose; required to SAVE (GET/read is open)

const URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_URL;
const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_TOKEN;
const PASSWORD = process.env.APP_PASSWORD || process.env.SYNC_PASSWORD || "";
const KEY = "saturdayshakes:collection";

async function redis(command) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return r.json(); // { result: ... }
}

module.exports = async (req, res) => {
  if (!URL || !TOKEN) {
    res.status(503).json({ error: "storage_not_configured" });
    return;
  }
  try {
    if (req.method === "GET") {
      const { result } = await redis(["GET", KEY]);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result ? JSON.parse(result) : {});
      return;
    }
    if (req.method === "POST") {
      if (PASSWORD) {
        const given = req.headers["x-app-password"] || "";
        if (given !== PASSWORD) { res.status(401).json({ error: "bad_password" }); return; }
      }
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body || typeof body !== "object") { res.status(400).json({ error: "bad_body" }); return; }
      await redis(["SET", KEY, JSON.stringify(body)]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
