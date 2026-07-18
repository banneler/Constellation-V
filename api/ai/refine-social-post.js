const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "social-post-refine";

const SYSTEM_PROMPT = `You are a professional LinkedIn content editor for Great Plains Communications.
Apply the user's requested edits while preserving LinkedIn-optimized formatting and the core message.
Return only JSON with key "suggestion".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { originalText, customPrompt } = await readJsonBody(req);
    required(originalText, "Missing originalText.");
    required(customPrompt, "Missing customPrompt.");

    const userMessage = [
      `Original draft:\n${originalText}`,
      "",
      `User edit request: ${customPrompt}`,
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
