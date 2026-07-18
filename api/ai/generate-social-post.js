const { callScopedJson, loadProductVerbiage, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "social-post";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    post_body: { type: "STRING" },
    suggestion: { type: "STRING" },
    hashtags: { type: "STRING" },
  },
  required: ["post_body", "suggestion", "hashtags"],
};

const SYSTEM_PROMPT = `You are a LinkedIn thought leader for Great Plains Communications.
Write professional, engaging social copy with LinkedIn-friendly whitespace.
Return only JSON. Put the main content into both "post_body" and "suggestion"; put hashtags in "hashtags".`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { userPrompt, product_names, article, industry } = body;
    const topic = userPrompt || article?.summary || article?.title || article?.headline;
    required(topic, "Missing social post topic.");

    const productContext = await loadProductVerbiage(product_names, industry);
    const userMessage = [
      article ? `Article/item JSON:\n${JSON.stringify(article, null, 2)}` : `Topic: ${topic}`,
      productContext ? `GPC context:\n${productContext}` : "",
    ].filter(Boolean).join("\n\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.6,
      maxOutputTokens: 1400,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/generate-social-post]", error);
    return sendError(res, error);
  }
};
