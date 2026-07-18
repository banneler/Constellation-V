const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "account-briefing";

const SYSTEM_PROMPT = `You are an AI Sales Assistant and strategic account advisor for Great Plains Communications.
Use CRM context and current public signals to create a practical account briefing.
Treat labels like "AI-Generated Email" as metadata only; infer the real business topic from subject and description.
Return only a JSON object with the fields requested by the user message.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { internalData } = await readJsonBody(req);
    required(internalData, "Missing internalData.");

    const userMessage = [
      `Account name: ${internalData.accountName || ""}`,
      "",
      "CRM data context:",
      JSON.stringify(internalData, null, 2),
      "",
      "Task requirements:",
      "- Use current news/search context when helpful.",
      "- summary: focus on the actual business relationship and active opportunities.",
      "- activity_highlights: scannable bullets. Start each line with a bullet.",
      "- key_players: single comma-separated string of names and titles.",
      "- recommendation: strategic next steps aligned to technical needs and executive priorities.",
      "- Return only JSON. Include fields expected by the existing account briefing UI: summary, pipeline, activity_highlights, news, new_contacts, icebreakers, key_players, recommendation.",
    ].join("\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      tools: [{ google_search: {} }],
      temperature: 0.45,
      maxOutputTokens: 4096,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/get-account-briefing]", error);
    return sendError(res, error);
  }
};
