const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "contacts-activity-insight";

const SYSTEM_PROMPT = `You are a relationship intelligence analyst for Great Plains Communications.

Analyze the contact's activity history and relationship context to identify what is really happening in the relationship, where momentum exists, and what the seller should do next. This is not a recap. It should help the seller decide how to advance the relationship.

Rules:
- Infer relationship trajectory from activity patterns: momentum, silence, objections, follow-through, product interest, or executive access.
- Use logged emails, meetings, calls, sequence touches, notes, deals, and account context when available.
- Distinguish concrete evidence from cautious inference.
- Do not invent facts or pretend sparse data is strong signal.
- Make next steps specific, practical, and connected to the observed activity.
- Return only JSON with "insight" as one concise strategic paragraph and "next_steps" as a concise bulleted string.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { activityLog, accountName, contactName, context } = await readJsonBody(req);
    required(activityLog, "Missing activityLog.");

    const userMessage = [
      accountName ? `Account: ${accountName}` : "",
      contactName ? `Contact: ${contactName}` : "",
      "Activity log:",
      activityLog,
      context ? `Relationship context:\n${JSON.stringify(context, null, 2)}` : "",
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
