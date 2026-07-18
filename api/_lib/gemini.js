const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.0-flash";

function requireGeminiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured."), { status: 500 });
  }
  return process.env.GEMINI_API_KEY;
}

function withDynamicPrompt(basePrompt, dynamicPrompt) {
  const profile = String(dynamicPrompt || "").trim();
  if (!profile) return basePrompt;
  return [
    basePrompt.trim(),
    "",
    "Personalized guidance for this authenticated user:",
    profile,
    "",
    "If this guidance conflicts with safety, factuality, or the route-specific task, prefer the safer route-specific instruction.",
  ].join("\n");
}

function withDynamicPrompts(basePrompt, prompts = {}) {
  const globalPrompt = String(prompts.globalPrompt || "").trim();
  const functionPrompt = String(prompts.functionPrompt || "").trim();
  if (!globalPrompt && !functionPrompt) return basePrompt;

  return [
    basePrompt.trim(),
    globalPrompt ? [
      "",
      "Global personalized guidance for this authenticated user:",
      globalPrompt,
    ].join("\n") : "",
    functionPrompt ? [
      "",
      "Function-specific personalized guidance for this AI surface:",
      functionPrompt,
    ].join("\n") : "",
    "",
    "If personalized guidance conflicts with safety, factuality, or the route-specific task, prefer the safer route-specific instruction.",
  ].filter(Boolean).join("\n");
}

async function callGeminiOnce({ model, systemPrompt, userMessage, responseMimeType, temperature = 0.5, maxOutputTokens = 2048 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${requireGeminiKey()}`;
  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(async () => ({ error: await response.text() }));
  if (!response.ok) {
    const message = data?.error?.message || data?.error || JSON.stringify(data);
    throw Object.assign(new Error(`Gemini API Error (${model}): ${message}`), { status: response.status });
  }
  if (data?.promptFeedback?.blockReason) {
    throw Object.assign(new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`), { status: 400 });
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) {
    throw Object.assign(
      new Error(`Gemini returned no content (finishReason: ${candidate?.finishReason || "unknown"}).`),
      { status: 502 }
    );
  }

  return {
    text: String(text).trim(),
    finishReason: candidate?.finishReason || null,
    model,
  };
}

async function callGemini(options) {
  try {
    return await callGeminiOnce({ ...options, model: options.model || DEFAULT_MODEL });
  } catch (error) {
    const status = Number(error?.status);
    if (![400, 404, 429].includes(status) || options.disableFallback) {
      throw error;
    }
    return callGeminiOnce({ ...options, model: options.fallbackModel || FALLBACK_MODEL });
  }
}

function stripCodeFences(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
}

function parseJsonObject(text) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(candidate);
}

module.exports = {
  callGemini,
  parseJsonObject,
  withDynamicPrompt,
  withDynamicPrompts,
};
