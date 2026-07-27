const { callGemini, parseJsonObject, withDynamicPrompts } = require("./gemini");
const { encodeEq, getDynamicPrompts, supabaseRest } = require("./supabase");

function asText(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function required(value, message) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
    throw Object.assign(new Error(message), { status: 400 });
  }
  return value;
}

async function callScopedJson({ userId, functionId, systemPrompt, userMessage, responseSchema, tools, temperature = 0.5, maxOutputTokens = 2048 }) {
  const dynamicPrompts = await getDynamicPrompts(userId, functionId);
  const scopedSystemPrompt = withDynamicPrompts(systemPrompt, dynamicPrompts);
  let lastParseError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await callGemini({
      systemPrompt: scopedSystemPrompt,
      userMessage,
      responseMimeType: tools ? undefined : "application/json",
      responseSchema,
      tools,
      temperature: attempt === 0 ? temperature : Math.min(temperature, 0.2),
      maxOutputTokens: attempt === 0 ? maxOutputTokens : Math.min(Math.max(maxOutputTokens * 2, maxOutputTokens + 1024), 8192),
    });

    try {
      return {
        data: parseJsonObject(result.text),
        model: result.model,
      };
    } catch (error) {
      lastParseError = error;
      const shouldRetry = attempt === 0 && (result.finishReason === "MAX_TOKENS" || error instanceof SyntaxError);
      if (!shouldRetry) break;
    }
  }

  const detail = lastParseError instanceof Error ? lastParseError.message : String(lastParseError || "unknown parse error");
  throw Object.assign(new Error(`AI returned malformed JSON after retry: ${detail}`), { status: 502 });
}

async function callScopedText({ userId, functionId, systemPrompt, userMessage, tools, temperature = 0.5, maxOutputTokens = 2048 }) {
  const dynamicPrompts = await getDynamicPrompts(userId, functionId);
  const result = await callGemini({
    systemPrompt: withDynamicPrompts(systemPrompt, dynamicPrompts),
    userMessage,
    tools,
    temperature,
    maxOutputTokens,
  });
  return {
    text: String(result.text || "").trim(),
    model: result.model,
  };
}

async function loadProductVerbiage(productNames, industry = "General") {
  const names = Array.isArray(productNames)
    ? productNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  if (names.length === 0) return "";

  const rows = await supabaseRest(
    `product_knowledge?select=title,content,verbiage_type,product_name,industry&product_name=in.(${names.map(encodeEq).join(",")})`,
    { serviceRole: true }
  );

  const selectedIndustry = String(industry || "General");
  const filtered = (rows || []).filter((item) => {
    if (selectedIndustry === "General") return item.industry == null;
    return item.industry == null || item.industry === selectedIndustry;
  });

  if (filtered.length === 0) return "";
  return [
    "Relevant Product Information:",
    "",
    ...filtered.map((item) => [
      "---",
      `Product: ${item.product_name}`,
      `Category: ${item.verbiage_type}`,
      `Title: ${item.title || "N/A"}`,
      `Content: ${item.content}`,
      "---",
      "",
    ].join("\n")),
  ].join("\n");
}

module.exports = {
  asText,
  callScopedJson,
  callScopedText,
  loadProductVerbiage,
  required,
};
