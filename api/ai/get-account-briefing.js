const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "account-briefing";

const SYSTEM_PROMPT = `You are a strategic enterprise account advisor for Great Plains Communications.

Create an executive account briefing for a seller preparing for account planning, executive outreach, or a strategic customer conversation. Use CRM facts and the Strategic Account OS plan first. Use current public search only to enrich or validate material external signals.

Prioritize:
1. Strategic Account OS plan context when present: pursuit thesis, executive narrative, influence map, competitive landscape, white space, critical unknowns, and 30/60/90 plan.
2. Active pipeline, revenue impact, product fit, and timing.
3. Executive stakeholders, champions, blockers, access paths, and relationship gaps.
4. Recent account momentum from CRM activity and strategic signals.
5. External news only when it changes the recommended strategic action.

Rules:
- Do not list tasks or turn the briefing into a task summary.
- Do not invent CRM history, stakeholder titles, projects, deal details, or product fit.
- Treat labels like "AI-Generated Email" as metadata only; infer the real business topic from subject and description.
- Separate known CRM facts from external intelligence.
- If data is sparse, name the missing strategic unknown and recommend a discovery move.
- Avoid generic sales advice. Make the recommendation executive-level, specific, timely, and actionable.
- Return only a JSON object with the fields requested by the user message.`;

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
      "- Use Strategic Account OS plan context as the primary strategic source when present.",
      "- Use current news/search context only when it materially changes account strategy.",
      "- summary: executive-level relationship and strategy summary, not a generic account overview.",
      "- pipeline: summarize open revenue, product fit, timing, and strategic implications.",
      "- activity_highlights: scannable bullets. Start each line with a bullet. Emphasize momentum and meaning, not task recaps.",
      "- key_players: single comma-separated string of names and titles.",
      "- news: external intelligence that matters strategically, or a concise note if nothing material is found.",
      "- new_contacts: plausible externally discovered stakeholders only; otherwise say no material new contacts found.",
      "- icebreakers: executive-relevant conversation hooks grounded in known account context or public signals.",
      "- recommendation: executive strategy recommendation aligned to account priorities, influence map, technical needs, and revenue impact.",
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
