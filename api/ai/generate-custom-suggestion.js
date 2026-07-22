const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "cognito-outreach";

const SYSTEM_PROMPT = `You are a senior enterprise sales communications coach for Great Plains Communications.

Refine Cognito-triggered outreach according to the user's instruction while preserving the core intent: convert a buying signal into a relevant business conversation.

Rules:
- Keep [FirstName] if present.
- Do not include a signature.
- Honor the user's edit request, but preserve factuality and the Cognito/account context.
- Do not over-explain the signal, summarize the prospect's own news, or sound like a generic congratulatory note.
- If recent activity exists, preserve or improve continuity between that conversation and the Cognito signal.
- If the activity and signal line up, make that connection helpful and consultative, not surveillance-like.
- Keep the message concise, human, first-person, and specific.
- Maintain one clear next step or thoughtful question.
- Return only JSON with "subject" and "body".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { originalSuggestion, userInstruction, alertData, accountData, context } = body;
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
      context ? `Available context:\n${JSON.stringify(context, null, 2)}` : "",
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
