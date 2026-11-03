const GEMINI_STOCK_MODEL = "gemini-3.7-flash";
const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
]);
const retiredModelWarnings = new Set();

function resolveGeminiModel(candidate, fallback = GEMINI_STOCK_MODEL) {
  const model = String(candidate || "").trim();
  if (!model) return fallback;
  if (!RETIRED_GEMINI_MODELS.has(model)) return model;
  if (!retiredModelWarnings.has(model)) {
    retiredModelWarnings.add(model);
    console.warn(`[gemini] ${model} is retired; using ${fallback}.`);
  }
  return fallback;
}

const DEFAULT_MODEL = resolveGeminiModel(process.env.GEMINI_MODEL, GEMINI_STOCK_MODEL);
const FALLBACK_MODEL = resolveGeminiModel(process.env.GEMINI_FALLBACK_MODEL, DEFAULT_MODEL);

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

function inlineDataParts(inlineData) {
  if (!inlineData) return [];
  const items = Array.isArray(inlineData) ? inlineData : [inlineData];
  return items.map((item) => {
    const data = String(item?.data || "").replace(/\s/g, "");
    if (!data) {
      throw Object.assign(new Error("Gemini image data is empty."), { status: 400 });
    }
    return {
      inlineData: {
        mimeType: String(item?.mimeType || "image/png"),
        data,
      },
    };
  });
}

async function callGeminiOnce({
  model,
  systemPrompt,
  userMessage,
  inlineData,
  responseMimeType,
  responseSchema,
  tools,
  temperature = 0.5,
  maxOutputTokens = 2048,
}) {
  const userText = String(userMessage || "");
  const parts = [
    ...(userText.trim() ? [{ text: userText }] : []),
    ...inlineDataParts(inlineData),
  ];
  if (parts.length === 0) {
    throw Object.assign(new Error("Gemini request has no content."), { status: 400 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${requireGeminiKey()}`;
  const instruction = String(systemPrompt || "").trim();
  const body = {
    ...(instruction
      ? { systemInstruction: { parts: [{ text: instruction }] } }
      : {}),
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(responseSchema ? { responseSchema } : {}),
    },
    ...(tools ? { tools } : {}),
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
  const model = resolveGeminiModel(options.model, DEFAULT_MODEL);
  const fallbackModel = resolveGeminiModel(options.fallbackModel, FALLBACK_MODEL);
  try {
    return await callGeminiOnce({ ...options, model });
  } catch (error) {
    const status = Number(error?.status);
    if (![400, 404, 429].includes(status) || options.disableFallback) {
      throw error;
    }
    return callGeminiOnce({ ...options, model: fallbackModel });
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
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  GEMINI_STOCK_MODEL,
  callGemini,
  parseJsonObject,
  resolveGeminiModel,
  withDynamicPrompt,
  withDynamicPrompts,
};
