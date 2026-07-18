const { callGemini, parseJsonObject, withDynamicPrompts } = require("../_lib/gemini");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { createPersonalContext, getDynamicPrompts, getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "presentation-highlight";

const SYSTEM_PROMPT = `You are the executive presentation strategist for Great Plains Communications (GPC), an enterprise connectivity and infrastructure partner.

Synthesize a Strategic Account Plan JSON into a three-slide executive highlight reel for a live discussion. Do not dump the document. Use compelling headlines, concise bullets, concrete names and signals when present, and cautious inference when data is sparse.

Return only valid JSON with this shape:
{
  "slides": {
    "situation": {
      "headline": "string",
      "subheadline": "string",
      "account_context": { "tier": "string", "priority": "string" },
      "pursuit_thesis": { "headline": "string", "bullets": ["string"] },
      "executive_narrative": "string",
      "pain_signals": { "headline": "string", "bullets": ["string"] },
      "critical_unknowns": { "headline": "string", "bullets": ["string"] },
      "momentum": { "insight": "string" },
      "psychology": { "headline": "string", "callouts": [{ "label": "string", "insight": "string" }] }
    },
    "battlefield": {
      "headline": "string",
      "competitive": { "headline": "string", "bullets": ["string"] },
      "white_space": { "headline": "string", "opportunity": "string", "wedge_summary": "string" },
      "influence": {
        "executive_hook": "string",
        "champions_hook": "string",
        "access_path_hook": "string",
        "champions": [{ "name": "string", "hook": "string" }]
      },
      "entry_points": [{ "name": "string", "headline": "string", "hook": "string", "badges": "string" }]
    },
    "execution": {
      "headline": "string",
      "plan_30": { "headline": "string", "bullets": ["string"] },
      "plan_60": { "headline": "string", "bullets": ["string"] },
      "plan_90": { "headline": "string", "bullets": ["string"] },
      "entrenchment_moat": "string",
      "signals": [{ "date_label": "string", "headline": "string" }]
    }
  }
}`;

const MAX_TEXT_FIELD_CHARS = 2400;
const MAX_ENTRY_POINTS = 8;
const MAX_INTERACTION_LOG = 24;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function truncateText(value, max = MAX_TEXT_FIELD_CHARS) {
  const text = value != null ? String(value).trim() : "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function compactPlanForPresentation(plan) {
  if (!isPlainObject(plan)) return plan;
  const draft = isPlainObject(plan.current_draft) ? plan.current_draft : null;
  const sections = draft && isPlainObject(draft.sections) ? { ...draft.sections } : null;
  if (!sections) return plan;

  if (Array.isArray(sections.entry_points)) {
    sections.entry_points = sections.entry_points
      .filter(isPlainObject)
      .slice(0, MAX_ENTRY_POINTS)
      .map((point) => Object.fromEntries(
        Object.entries(point).map(([key, value]) => [key, typeof value === "string" ? truncateText(value, 900) : value])
      ));
  }

  if (Array.isArray(sections.interaction_log)) {
    sections.interaction_log = sections.interaction_log
      .filter((entry) => {
        if (!isPlainObject(entry)) return false;
        const source = entry.source != null ? String(entry.source).toLowerCase() : "";
        return source !== "activity" && source !== "crm";
      })
      .slice(0, MAX_INTERACTION_LOG)
      .map((entry) => ({
        ...entry,
        text: truncateText(entry.text ?? entry.interaction ?? entry.key_insight, 500),
      }));
  }

  return {
    schema_version: plan.schema_version ?? 2,
    current_draft: { sections },
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const accountName = body.accountName != null ? String(body.accountName).trim() : "Account";
    const plan = compactPlanForPresentation(body.plan || {});
    const dynamicPrompts = await getDynamicPrompts(user.id, FUNCTION_ID);
    const userMessage = [
      `Account: ${accountName}`,
      "",
      "Strategic Account Plan JSON (schema v2, signal-only interaction_log):",
      JSON.stringify(plan, null, 2),
    ].join("\n");

    const result = await callGemini({
      systemPrompt: withDynamicPrompts(SYSTEM_PROMPT, dynamicPrompts),
      userMessage,
      responseMimeType: "application/json",
      temperature: 0.45,
      maxOutputTokens: 8192,
    });

    const highlight = parseJsonObject(result.text);
    const contextId = await createPersonalContext(user.id, userMessage, result.text, FUNCTION_ID);
    return sendJson(res, 200, {
      highlight,
      generated_at: new Date().toISOString(),
      model: result.model,
      personal_context_id: contextId,
    });
  } catch (error) {
    console.error("[api/ai/generate-presentation-highlight]", error);
    return sendError(res, error);
  }
};
