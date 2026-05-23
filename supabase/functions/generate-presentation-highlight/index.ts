import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the executive presentation strategist for Great Plains Communications (GPC), an enterprise connectivity and infrastructure partner.

You synthesize a Strategic Account Plan JSON into a THREE-SLIDE HIGHLIGHT REEL for a live executive discussion — NOT a document dump. The full plan summary PDF is the reference document; this presentation is the conversation backdrop.

Framework (Elite Strategic Enterprise Pursuit Operating System):
- Answer: Why would this organization change? What pressure exists? Who influences outcomes? What timing matters? What is the next best strategic move?
- Tone: Confident, insight-led, boardroom-ready. Headlines first. Bullets are punchy (max 12 words each).
- Never paste raw paragraphs. Every block needs a compelling HEADLINE plus distilled bullets or hooks.
- Use concrete names, roles, and signals from the plan when present.
- If data is sparse, infer cautiously and label gaps briefly — do not invent facts.

Output ONLY valid JSON matching this exact schema (no markdown fences):
{
  "slides": {
    "situation": {
      "headline": "string — provocative one-line account thesis for the room",
      "subheadline": "string — optional supporting line, max 20 words",
      "pursuit_thesis": {
        "headline": "string",
        "bullets": ["string", "..."] // 3-4 bullets max
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
      "influence": {
        "executive_hook": "string — one headline about exec layer",
        "champions_hook": "string — one headline about mid-level champions"
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
      "signals": [
        { "date_label": "string — e.g. May 20", "headline": "string — signal as headline, not full note" }
      ] // up to 3, newest first
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
    const plan = body.plan ?? {};

    const userMessage = [
      `Account: ${accountName}`,
      "",
      "Strategic Account Plan JSON (current_draft sections):",
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
