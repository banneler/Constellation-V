const { callGemini, withDynamicPrompt } = require("../_lib/gemini");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { createPersonalContext, getDynamicPrompt, getUserFromRequest } = require("../_lib/supabase");

const BASE_SYSTEM_PROMPT = `You are a Senior Account Executive at Great Plains Communications (GPC), focused on enterprise accounts. Your tone is professionally casual: confident, warm, and direct, not stiff or corporate.

The user will give you an ordered list of agenda items for a customer meeting. Write a single block of text suitable for pasting into a calendar invite body. Include a brief friendly intro, the agenda items in the provided order exactly once, and a short closing line. Do not add a subject line or meta commentary.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const items = Array.isArray(body.items) ? body.items.map((item) => String(item).trim()).filter(Boolean) : [];
    const prompt = body.prompt != null ? String(body.prompt).trim() : "";
    const accountName = body.accountName != null ? String(body.accountName).trim() : "";

    if (items.length === 0) {
      return sendJson(res, 400, { error: 'Missing or empty "items" array in request body.' });
    }

    const dynamicPrompt = await getDynamicPrompt(user.id);
    const itemsBlock = items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const userMessage = [
      accountName ? `Account/company name: ${accountName}` : "",
      "Agenda items in order:",
      itemsBlock,
      prompt ? `Additional context from user: ${prompt}` : "",
    ].filter(Boolean).join("\n\n");

    const result = await callGemini({
      systemPrompt: withDynamicPrompt(BASE_SYSTEM_PROMPT, dynamicPrompt),
      userMessage,
      temperature: 0.6,
      maxOutputTokens: 1024,
    });

    const contextId = await createPersonalContext(user.id, userMessage, result.text);
    return sendJson(res, 200, {
      agenda: result.text,
      generated_at: new Date().toISOString(),
      model: result.model,
      personal_context_id: contextId,
    });
  } catch (error) {
    console.error("[api/ai/generate-agenda]", error);
    return sendError(res, error);
  }
};
