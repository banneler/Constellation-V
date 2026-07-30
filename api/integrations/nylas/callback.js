const { sendError } = require("../../_lib/http");
const {
  exchangeCodeForGrant,
  getAppOrigin,
  getRedirectUri,
  upsertUserIntegration,
  verifyState,
} = require("../../_lib/nylas");

function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const origin = getAppOrigin(req);
  try {
    const url = new URL(req.url, origin);
    const errorParam = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (errorParam) {
      return redirect(res, `${origin}/command-center.html?integrations=error&reason=${encodeURIComponent(errorParam)}`);
    }
    if (!code || !state) {
      return redirect(res, `${origin}/command-center.html?integrations=error&reason=missing_code`);
    }

    const payload = verifyState(state);
    const redirectUri = getRedirectUri(req);
    const token = await exchangeCodeForGrant({ code, redirectUri });
    const grantId = token.grant_id || token.grantId || token.data?.grant_id;
    const email = token.email || token.data?.email || null;
    const provider = payload.provider === "microsoft" ? "microsoft" : "google";

    if (!grantId) {
      throw Object.assign(new Error("Nylas token exchange did not return a grant_id."), { status: 502 });
    }

    await upsertUserIntegration({
      user_id: payload.uid,
      provider,
      nylas_grant_id: grantId,
      email,
      status: "connected",
    });

    const returnTo = payload.returnTo || "/command-center.html";
    const sep = returnTo.includes("?") ? "&" : "?";
    return redirect(res, `${origin}${returnTo}${sep}integrations=connected`);
  } catch (error) {
    console.error("[api/integrations/nylas/callback]", error);
    try {
      return redirect(
        res,
        `${origin}/command-center.html?integrations=error&reason=${encodeURIComponent(error.message || "callback_failed")}`
      );
    } catch {
      return sendError(res, error);
    }
  }
};
