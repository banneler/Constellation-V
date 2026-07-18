const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "cognito-outreach";

const SYSTEM_PROMPT = `You are a senior sales communications coach for Great Plains Communications.
Refine an outreach email according to the user's instruction.
Keep [FirstName] if present. Do not include a signature. Return only JSON with "subject" and "body".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { originalSuggestion, userInstruction, alertData, accountData } = body;
    required(originalSuggestion?.subject, "Missing originalSuggestion.subject.");
    required(userInstruction, "Missing userInstruction.");

    const userMessage = [
      "Current email draft:",
      `Subject: ${originalSuggestion.subject}`,
      `Body: ${originalSuggestion.body || ""}`,
      "",
      `User instruction: ${userInstruction}`,
      accountData?.name ? `Account: ${accountData.name}` : "",
      alertData?.headline ? `Original signal: ${alertData.headline} - ${alertData.summary || ""}` : "",
    ].filter(Boolean).join("\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.55,
      maxOutputTokens: 1024,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/generate-custom-suggestion]", error);
    return sendError(res, error);
  }
};
