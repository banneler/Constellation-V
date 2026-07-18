const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "contacts-activity-insight";

const SYSTEM_PROMPT = `You are a Sales Operations Analyst for Great Plains Communications.
Analyze a CRM activity log and produce a concise relationship insight plus suggested next steps.
Return only JSON with "insight" as a summary paragraph and "next_steps" as a concise bulleted string.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { activityLog, accountName, contactName } = await readJsonBody(req);
    required(activityLog, "Missing activityLog.");

    const userMessage = [
      accountName ? `Account: ${accountName}` : "",
      contactName ? `Contact: ${contactName}` : "",
      "Activity log:",
      activityLog,
    ].filter(Boolean).join("\n\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.35,
      maxOutputTokens: 1200,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/get-activity-insight]", error);
    return sendError(res, error);
  }
};
