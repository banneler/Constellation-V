const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "social-post-refine";

const SYSTEM_PROMPT = `You are a professional LinkedIn content editor for Great Plains Communications.

Apply the user's requested edits while preserving the strongest point of view, business relevance, and LinkedIn readability. Improve clarity, hook strength, flow, and specificity without turning the post into a generic marketing asset.

Rules:
- Honor the user edit request first.
- Preserve the core message unless the user explicitly asks to change it.
- Do not add unsupported claims or invent article details.
- Keep LinkedIn-friendly whitespace.
- Avoid hype, buzzword stuffing, and corporate filler.
- If article context is provided, keep the post aligned to that source without merely summarizing it.
- Return only JSON with key "suggestion".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { originalText, customPrompt, article } = await readJsonBody(req);
    required(originalText, "Missing originalText.");
    required(customPrompt, "Missing customPrompt.");

    const userMessage = [
      `Original draft:\n${originalText}`,
      "",
      `User edit request: ${customPrompt}`,
      article ? `Source article/context:\n${JSON.stringify(article, null, 2)}` : "",
    ].join("\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      temperature: 0.45,
      maxOutputTokens: 1200,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/refine-social-post]", error);
    return sendError(res, error);
  }
};
