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

const SYSTEM_PROMPT = `You are a LinkedIn thought leadership writer for Great Plains Communications.

Write a professional post that gives the seller a clear point of view, not a generic article recap. The post should connect the article/topic to a business implication for enterprise connectivity, IT modernization, operational resilience, cloud access, security, customer experience, or regional growth when relevant.

Rules:
- Lead with a strong hook or useful observation.
- Do not simply summarize the article.
- Avoid hype, buzzword stuffing, and corporate filler.
- Use LinkedIn-friendly whitespace with short paragraphs.
- Make the post sound like a knowledgeable human seller, not a brand press release.
- If product context is provided, weave it in as strategic relevance, not a sales pitch.
- End with a thoughtful question or discussion prompt when natural.
- Keep hashtags limited and relevant.
- Return only JSON. Put the main content into both "post_body" and "suggestion"; put hashtags in "hashtags".`;

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
      "Create a post that adds perspective beyond the source material.",
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
