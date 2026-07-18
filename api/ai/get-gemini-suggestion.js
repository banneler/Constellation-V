const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "cognito-outreach";

const SYSTEM_PROMPT = `You are an expert telecommunications sales executive for Great Plains Communications.
Write concise first-person outreach based on a Cognito intelligence signal.
Use [FirstName] for the recipient. Do not include a signature. Return only JSON with "subject" and "body".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { alertData, accountData } = await readJsonBody(req);
    required(alertData, "Missing alertData.");
    required(accountData, "Missing accountData.");

    const userMessage = [
      `Signal headline: ${alertData.headline || ""}`,
      `Signal summary: ${alertData.summary || ""}`,
      `Trigger type: ${alertData.trigger_type || ""}`,
      `Account: ${accountData.name || ""}`,
      "",
      "Return a JSON object with a compelling subject and a polished outreach body.",
    ].join("\n");

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
    console.error("[api/ai/get-gemini-suggestion]", error);
    return sendError(res, error);
  }
};
