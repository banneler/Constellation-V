const { callGemini, parseJsonObject } = require("../_lib/gemini");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const EXTRACTION_PROMPT = `Please extract the following contact information from the provided email signature image or business card.
The output MUST be a raw JSON object with the following keys:
"first_name": (string, required if found)
"last_name": (string, required if found)
"email": (string, required if found, valid email format)
"phone": (string, optional, include all phone numbers found, comma-separated if multiple)
"title": (string, optional)
"company": (string, optional)

If a piece of information is not explicitly present, return an empty string for that key.
Prioritize accuracy. Do not make up information.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    first_name: { type: "STRING" },
    last_name: { type: "STRING" },
    email: { type: "STRING" },
    phone: { type: "STRING" },
    title: { type: "STRING" },
    company: { type: "STRING" },
  },
  required: ["first_name", "last_name", "email"],
};

function asContactString(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeImage(image) {
  const raw = String(image || "").trim();
  const dataUrl = raw.match(/^data:([^;]+);base64,([\s\S]+)$/i);
  if (dataUrl) {
    return {
      mimeType: dataUrl[1],
      data: dataUrl[2].replace(/\s/g, ""),
    };
  }
  return {
    mimeType: "image/png",
    data: raw.replace(/\s/g, ""),
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const image = normalizeImage(body?.image);
    if (!image.data) {
      return sendJson(res, 400, { error: "Missing image data in request body." });
    }

    const result = await callGemini({
      userMessage: EXTRACTION_PROMPT,
      inlineData: image,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      maxOutputTokens: 1024,
    });
    const parsed = parseJsonObject(result.text);
    return sendJson(res, 200, {
      first_name: asContactString(parsed.first_name),
      last_name: asContactString(parsed.last_name),
      email: asContactString(parsed.email),
      phone: asContactString(parsed.phone),
      title: asContactString(parsed.title),
      company: asContactString(parsed.company),
    });
  } catch (error) {
    console.error("[api/ai/extract-contact-info]", error);
    return sendError(res, error);
  }
};
