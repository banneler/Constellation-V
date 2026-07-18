const { callScopedJson, loadProductVerbiage, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest, supabaseRest, encodeEq } = require("../_lib/supabase");

const FUNCTION_ID = "contacts-email";

const SYSTEM_PROMPT = `You write sales emails for Great Plains Communications.
Be concise, value-first, human, and specific to the recipient and account context.
Use [FirstName] for the recipient. Do not include a signature. Return only JSON with "subject" and "body".`;

async function loadUserIdentity(userId) {
  const rows = await supabaseRest(
    `user_quotas?id=eq.${encodeEq(userId)}&select=full_name,title&limit=1`,
    { serviceRole: true }
  ).catch(() => []);
  return rows?.[0] || {};
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { contactName, accountName, userPrompt, product_names, industry } = body;
    required(contactName, "Missing contactName.");
    required(userPrompt, "Missing userPrompt.");

    const [identity, productContext] = await Promise.all([
      loadUserIdentity(user.id),
      loadProductVerbiage(product_names, industry),
    ]);

    const userMessage = [
      identity.full_name || identity.title ? `Sender: ${identity.full_name || "GPC representative"}${identity.title ? `, ${identity.title}` : ""}` : "",
      `Goal: ${userPrompt}`,
      `Recipient: ${contactName}`,
      accountName ? `Account: ${accountName}` : "",
      productContext ? `Technical context to use:\n${productContext}` : "",
    ].filter(Boolean).join("\n\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.55,
      maxOutputTokens: 1400,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/generate-prospect-email]", error);
    return sendError(res, error);
  }
};
