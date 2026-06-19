// Vercel serverless function — shared cross-device store for the Cocktail Compendium.
//
// Works with EITHER backend, auto-detected from env vars:
//   1. Upstash REST API  — KV_REST_API_URL / UPSTASH_REDIS_REST_URL (https) + matching token.
//                          Zero-dependency path: talks over global fetch.
//   2. Redis wire proto  — REDIS_URL (redis:// or rediss://), provisioned by the Vercel
//                          Marketplace "Redis" store. Uses the `redis` npm client.
//
//   APP_PASSWORD  — a secret you choose; required to SAVE (GET/read stays open). Optional.

const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL;
const PASSWORD = process.env.APP_PASSWORD || process.env.SYNC_PASSWORD || "";
const KEY = "saturdayshakes:collection";

// ---- Backend 1: Upstash REST (no dependency) -------------------------------
async function restGet() {
  const r = await fetch(REST_URL + "/get/" + encodeURIComponent(KEY), {
    headers: { Authorization: "Bearer " + REST_TOKEN },
  });
  if (!r.ok) throw new Error("redis-rest " + r.status);
  const { result } = await r.json();
  return result;
}
async function restSet(value) {
  const r = await fetch(REST_URL + "/set/" + encodeURIComponent(KEY), {
    method: "POST",
    headers: { Authorization: "Bearer " + REST_TOKEN, "Content-Type": "text/plain" },
    body: value,
  });
  if (!r.ok) throw new Error("redis-rest " + r.status);
}

// ---- Backend 2: Redis wire protocol (node-redis), client reused per warm fn -
let _clientPromise = null;
function getClient() {
  if (!_clientPromise) {
    const { createClient } = require("redis");
    const client = createClient({ url: REDIS_URL });
    client.on("error", () => {}); // avoid unhandled 'error' crashing the function
    _clientPromise = client.connect().then(() => client);
  }
  return _clientPromise;
}
async function wireGet() {
  const client = await getClient();
  return client.get(KEY);
}
async function wireSet(value) {
  const client = await getClient();
  await client.set(KEY, value);
}

const useRest = !!(REST_URL && REST_TOKEN);
const configured = useRest || !!REDIS_URL;

module.exports = async (req, res) => {
  if (!configured) {
    res.status(503).json({ error: "storage_not_configured" });
    return;
  }
  try {
    if (req.method === "GET") {
      const result = useRest ? await restGet() : await wireGet();
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
      const payload = JSON.stringify(body);
      if (useRest) await restSet(payload); else await wireSet(payload);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
