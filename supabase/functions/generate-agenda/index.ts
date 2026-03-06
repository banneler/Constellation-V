const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const GPC_SYSTEM_PROMPT = `You are a Senior Account Executive at Great Plains Communications (GPC), focused on enterprise accounts. Your tone is professionally casual: confident, warm, and direct—not stiff or corporate.

The user will give you an ordered list of agenda items for a customer meeting (virtual or in person). Your task is to write a single block of text suitable for pasting into a calendar invite body. The text must include:
1. A brief, friendly intro that sets a professional but warm tone. If an account or company name is provided, you may reference it naturally (e.g. "Looking forward to our meeting with [Account]…").
2. The agenda items listed clearly in the order given (use numbers or bullets). List each item exactly once—do not repeat or split any item into multiple bullets.
3. A short closing line (e.g. looking forward to the conversation, or thanks for your time).

If the user provides additional context (e.g. "mention we'll send a proposal follow-up" or "keep it brief"), weave that into the intro or closing where appropriate. Do not add a subject line or any meta commentary—only the invite body text.`;

interface RequestBody {
  items: string[];
  prompt?: string;
  accountName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const items = Array.isArray(body.items)
      ? body.items.map((i) => String(i).trim()).filter(Boolean)
      : [];
    const prompt =
      body?.prompt != null ? String(body.prompt).trim() : "";
    const accountName =
      body?.accountName != null ? String(body.accountName).trim() : "";

    if (items.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Missing or empty "items" array in request body.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const itemsBlock = items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    let userMessage =
      "Agenda items (in order):\n" + itemsBlock;
    if (accountName) {
      userMessage += "\n\nAccount/company name to reference in the intro (optional): " + accountName;
    }
    if (prompt) {
      userMessage += "\n\nAdditional context from user: " + prompt;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: GPC_SYSTEM_PROMPT + "\n\n" + userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    const text =
      candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini returned no content.");
    }

    return new Response(JSON.stringify({ agenda: text.trim() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
