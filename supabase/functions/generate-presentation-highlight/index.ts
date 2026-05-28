import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL_PRIMARY = "gemini-2.5-flash";
const GEMINI_MODEL_FALLBACK = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are the executive presentation strategist for Great Plains Communications (GPC), an enterprise connectivity and infrastructure partner.

You synthesize a Strategic Account Plan JSON (schema v2) into a THREE-SLIDE HIGHLIGHT REEL for a live executive discussion — NOT a document dump. The full plan summary PDF is the reference document; this presentation is the conversation backdrop.

Framework (Elite Strategic Enterprise Pursuit Operating System):
- Answer: Why would this organization change? What pressure exists? Who influences outcomes? What timing matters? What is the next best strategic move?
- Tone: Confident, insight-led, boardroom-ready. Headlines first. Bullets are punchy (max 12 words each).
- Never paste raw paragraphs. Every block needs a compelling HEADLINE plus distilled bullets or hooks.
- Use concrete names, roles, and signals from the plan when present.
- If data is sparse, infer cautiously and label gaps briefly — do not invent facts.

Schema v2 section mapping (read these keys from the plan JSON):
- account_snapshot.tier + account_snapshot.pursuit_priority → situation.account_context (room hook)
- pursuit_thesis.thesis, action_forcing_event, why_account_matters, timing, executive_narrative → situation.pursuit_thesis bullets
- pain_signals.selected + pain_signals.notes → situation.pain_signals
- critical_unknowns.blindspots (string[]) → situation.critical_unknowns
- psychology gravity fields → situation.psychology callouts
- relationship_momentum → situation.momentum.insight (beyond the numeric score)
- competitive_landscape + entrenchment → battlefield.competitive bullets
- white_space[] → battlefield.white_space (single top opportunity by importance/visibility)
- influence_mapping + influence_mapping.access_path → battlefield.influence hooks (executive, champions, access_path_hook)
- entry_points[] → battlefield.entry_points (1-2 max)
- plan_30_60_90.plan_30 / plan_60 / plan_90 → execution plan horizons
- plan_30_60_90.client_commitments[] → optional give/get bullets on execution slide (max 3)
- interaction_log ONLY (entries with source signal or manual) → execution.signals — NEVER use CRM activity rows
- entrenchment.moat_pills + entrenchment.difficult_to_remove → execution.entrenchment_moat (one-liner on incumbent moat)

Signals-only rule (mandatory):
- For execution.signals, use interaction_log entries where source is NOT "activity".
- Ignore momentum_notes and any interaction_log rows with source "activity" or "crm".
- Distill each signal to a headline — not the full note text.

Output ONLY valid JSON matching this exact schema (no markdown fences):
{
  "slides": {
    "situation": {
      "headline": "string — provocative one-line account thesis for the room",
      "subheadline": "string — optional supporting line, max 20 words",
      "account_context": {
        "tier": "string — from account_snapshot.tier, e.g. Tier 1",
        "priority": "string — from account_snapshot.pursuit_priority"
      },
      "pursuit_thesis": {
        "headline": "string",
        "bullets": ["string", "..."] // 3-4 bullets max
      },
      "executive_narrative": "string — one-line executive narrative hook from pursuit_thesis.executive_narrative",
      "pain_signals": {
        "headline": "string",
        "bullets": ["string"] // 2-3 bullets from pain_signals pills/notes
      },
      "critical_unknowns": {
        "headline": "string",
        "bullets": ["string"] // 2-3 bullets from blindspots list
      },
      "momentum": {
        "insight": "string — one sentence on relationship trajectory beyond the score"
      },
      "psychology": {
        "headline": "string",
        "callouts": [
          { "label": "string", "insight": "string" }
        ] // exactly 3 callouts for top dynamics
      }
    },
    "battlefield": {
      "headline": "string",
      "competitive": {
        "headline": "string",
        "bullets": ["string"] // 3-4 bullets
      },
      "white_space": {
        "headline": "string — top opportunity area label",
        "opportunity": "string — max 22 words on the highest-value white space row"
      },
      "influence": {
        "executive_hook": "string — one headline about exec layer",
        "champions_hook": "string — one headline about mid-level champions",
        "access_path_hook": "string — headline from access_path strategy/bridge/desired access"
      },
      "entry_points": [
        {
          "name": "string",
          "headline": "string",
          "hook": "string — max 18 words",
          "badges": "string — e.g. Trusted · High influence · Strategic comms"
        }
      ] // 1-2 entries max
    },
    "execution": {
      "headline": "string",
      "plan_30": { "headline": "string", "bullets": ["string"] }, // 3 bullets max
      "plan_60": { "headline": "string", "bullets": ["string"] },
      "plan_90": { "headline": "string", "bullets": ["string"] },
      "entrenchment_moat": "string — one-liner on why incumbents are difficult to remove",
      "signals": [
        { "date_label": "string — e.g. May 20", "headline": "string — signal as headline, not full note" }
      ] // up to 3, newest first; interaction_log signals only
    }
  }
}`;

interface RequestBody {
  plan?: unknown;
  accountName?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
}

function parseHighlightJson(raw: string): unknown {
  const cleaned = stripCodeFences(raw);
  return JSON.parse(cleaned);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

const MAX_TEXT_FIELD_CHARS = 2400;
const MAX_ENTRY_POINTS = 8;
const MAX_INTERACTION_LOG = 24;
const MAX_CLIENT_COMMITMENTS = 12;

function truncateText(value: unknown, max = MAX_TEXT_FIELD_CHARS): string {
  const text = value != null ? String(value).trim() : "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Strip CRM activity rows from interaction_log before AI synthesis.
 * Client-facing exports are signals-only per docs/saos/DECISIONS.md #1.
 */
function sanitizePlanForPresentation(plan: unknown): unknown {
  if (!isPlainObject(plan)) return plan;

  const draft = plan.current_draft;
  if (!isPlainObject(draft)) return plan;

  const sections = draft.sections;
  if (!isPlainObject(sections)) return plan;

  const interactionLog = Array.isArray(sections.interaction_log)
    ? sections.interaction_log
    : [];

  const signalOnlyLog = interactionLog.filter((entry) => {
    if (!isPlainObject(entry)) return false;
    const source = entry.source != null ? String(entry.source).toLowerCase() : "";
    return source !== "activity" && source !== "crm";
  });

  return {
    ...plan,
    current_draft: {
      ...draft,
      sections: {
        ...sections,
        interaction_log: signalOnlyLog,
      },
    },
  };
}

/**
 * Shrink payload for Gemini — omit plan history and cap large arrays/strings.
 */
function compactPlanForPresentation(plan: unknown): unknown {
  const sanitized = sanitizePlanForPresentation(plan);
  if (!isPlainObject(sanitized)) return sanitized;

  const draft = sanitized.current_draft;
  if (!isPlainObject(draft) || !isPlainObject(draft.sections)) {
    return sanitized;
  }

  const sections = { ...draft.sections };

  if (Array.isArray(sections.entry_points)) {
    sections.entry_points = sections.entry_points
      .filter(isPlainObject)
      .slice(0, MAX_ENTRY_POINTS)
      .map((point) => {
        const compact: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(point)) {
          if (typeof value === "string") {
            compact[key] = truncateText(value, 900);
          } else {
            compact[key] = value;
          }
        }
        return compact;
      });
  }

  if (Array.isArray(sections.interaction_log)) {
    sections.interaction_log = sections.interaction_log
      .filter(isPlainObject)
      .slice(0, MAX_INTERACTION_LOG)
      .map((entry) => ({
        ...entry,
        text: truncateText(entry.text ?? entry.interaction ?? entry.key_insight, 500),
      }));
  }

  const plan306090 = isPlainObject(sections.plan_30_60_90)
    ? { ...sections.plan_30_60_90 }
    : null;
  if (plan306090) {
    for (const key of ["plan_30", "plan_60", "plan_90"]) {
      if (key in plan306090) {
        plan306090[key] = truncateText(plan306090[key]);
      }
    }
    if (Array.isArray(plan306090.client_commitments)) {
      plan306090.client_commitments = plan306090.client_commitments
        .map((entry) => truncateText(entry, 280))
        .filter(Boolean)
        .slice(0, MAX_CLIENT_COMMITMENTS);
    }
    sections.plan_30_60_90 = plan306090;
  }

  const thesis = isPlainObject(sections.pursuit_thesis)
    ? { ...sections.pursuit_thesis }
    : null;
  if (thesis) {
    for (const key of Object.keys(thesis)) {
      if (typeof thesis[key] === "string") {
        thesis[key] = truncateText(thesis[key]);
      }
    }
    sections.pursuit_thesis = thesis;
  }

  const unknowns = isPlainObject(sections.critical_unknowns)
    ? { ...sections.critical_unknowns }
    : null;
  if (unknowns && Array.isArray(unknowns.blindspots)) {
    unknowns.blindspots = unknowns.blindspots
      .map((entry) => truncateText(entry, 280))
      .filter(Boolean)
      .slice(0, 12);
    sections.critical_unknowns = unknowns;
  }

  return {
    schema_version: sanitized.schema_version ?? 2,
    current_draft: { sections },
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  userMessage: string,
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`Gemini API Error (${model}): ${errText}`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  const data = await response.json() as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = candidate?.finishReason ?? "unknown";
    throw new Error(`Gemini returned no content (finishReason: ${reason}).`);
  }

  return text;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return jsonResponse({
        error: "GEMINI_API_KEY is not configured on the server. Redeploy the edge function with secrets set.",
      }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const accountName = body.accountName != null
      ? String(body.accountName).trim()
      : "Account";
    const plan = compactPlanForPresentation(body.plan ?? {});

    const userMessage = [
      `Account: ${accountName}`,
      "",
      "Strategic Account Plan JSON (schema v2, signal-only interaction_log):",
      JSON.stringify(plan, null, 2),
    ].join("\n");

    let text: string;
    let modelUsed = GEMINI_MODEL_PRIMARY;

    try {
      text = await callGemini(apiKey, GEMINI_MODEL_PRIMARY, userMessage);
    } catch (primaryErr) {
      const status = primaryErr instanceof Error &&
          "status" in primaryErr
        ? (primaryErr as Error & { status?: number }).status
        : undefined;
      const shouldFallback = status === 404 || status === 400 || status === 429;
      if (!shouldFallback) throw primaryErr;

      console.warn(
        "[generate-presentation-highlight] Primary model failed, trying fallback:",
        primaryErr,
      );
      text = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, userMessage);
      modelUsed = GEMINI_MODEL_FALLBACK;
    }

    let highlight: unknown;
    try {
      highlight = parseHighlightJson(text);
    } catch {
      throw new Error("Gemini returned invalid JSON for presentation highlight.");
    }

    return jsonResponse({
      highlight,
      generated_at: new Date().toISOString(),
      model: modelUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-presentation-highlight]", message);
    return jsonResponse({ error: message }, 500);
  }
});
