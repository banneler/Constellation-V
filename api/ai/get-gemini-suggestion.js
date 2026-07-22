const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "cognito-outreach";

const SYSTEM_PROMPT = `You are an expert enterprise telecommunications sales executive for Great Plains Communications.

Write concise first-person outreach based on a Cognito buying signal. The goal is to turn the signal into a relevant business conversation without sounding like the seller is merely repeating the prospect's own news back to them.

Rules:
- Use [FirstName] for the recipient.
- Do not include a signature.
- Write in first person as the seller.
- Do not over-explain the signal, summarize the article, or congratulate generically.
- If recent activity exists, use it to create continuity between the live conversation and the new signal.
- If the activity and signal line up, make that connection feel helpful and consultative, not surveillance-like.
- Bridge from the signal to a likely business pressure, operational question, risk, or timing issue.
- Keep the message short, human, and specific.
- Use available contact/account context to choose a business-relevant angle, but do not invent titles, projects, or facts.
- End with one low-friction next step or thoughtful question.
- Return only JSON with "subject" and "body".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { alertData, accountData, context } = await readJsonBody(req);
    required(alertData, "Missing alertData.");
    required(accountData, "Missing accountData.");

    const userMessage = [
      `Signal headline: ${alertData.headline || ""}`,
      `Signal summary: ${alertData.summary || ""}`,
      `Trigger type: ${alertData.trigger_type || ""}`,
      `Account: ${accountData.name || ""}`,
      context ? `Available context:\n${JSON.stringify(context, null, 2)}` : "",
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
