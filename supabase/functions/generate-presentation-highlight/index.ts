import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";

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
- pursuit_thesis (core, why_account_matters, cost_of_standing_still, timing) → situation.pursuit_thesis bullets
- pursuit_thesis.executive_narrative → situation.executive_narrative (one executive-facing line)
- pain_signals.selected + pain_signals.notes → situation.pain_signals
- critical_unknowns.unknowns + critical_unknowns.executive_language_pills → situation.critical_unknowns
- psychology gravity fields → situation.psychology callouts
- relationship_momentum → situation.momentum.insight (beyond the numeric score)
- competitive_landscape + entrenchment → battlefield.competitive bullets
- white_space[] → battlefield.white_space (single top opportunity by importance/visibility)
- influence_mapping + influence_mapping.access_path → battlefield.influence hooks (executive, champions, access_path_hook)
- entry_points[] → battlefield.entry_points (1-2 max)
- plan_30_60_90 → execution plan horizons
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
        "bullets": ["string"] // 2-3 bullets from open questions / language pills
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
      return jsonResponse({ error: "GEMINI_API_KEY is not configured." }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const accountName = body.accountName != null
      ? String(body.accountName).trim()
      : "Account";
    const plan = sanitizePlanForPresentation(body.plan ?? {});

    const userMessage = [
      `Account: ${accountName}`,
      "",
      "Strategic Account Plan JSON (schema v2, signal-only interaction_log):",
      JSON.stringify(plan, null, 2),
    ].join("\n");

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned no content.");
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
      model: GEMINI_MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
