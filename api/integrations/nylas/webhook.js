const { handleOptions, sendError, sendJson } = require("../../_lib/http");
const { markGrantInvalid, verifyNylasWebhookSignature } = require("../../_lib/nylas");

function readRawBody(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  if (req.body && typeof req.body === "object") return Promise.resolve(JSON.stringify(req.body));
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  // Nylas challenge handshake
  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const challenge = url.searchParams.get("challenge");
    if (challenge) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end(challenge);
      return;
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const raw = await readRawBody(req);
    const signature = req.headers["x-nylas-signature"] || req.headers["x-nylas-signature".toLowerCase()];
    if (!verifyNylasWebhookSignature(raw, signature)) {
      return sendJson(res, 401, { error: "Invalid webhook signature." });
    }

    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    const type = String(payload.type || payload?.data?.object?.type || "").toLowerCase();
    const grantId =
      payload.data?.object?.grant_id ||
      payload.data?.grant_id ||
      payload.grant_id ||
      payload.data?.object?.id;

    if (grantId && (type.includes("grant") || type.includes("invalid") || type.includes("deleted"))) {
      await markGrantInvalid(grantId);
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("[api/integrations/nylas/webhook]", error);
    return sendError(res, error);
  }
};
