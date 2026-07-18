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
  const result = await callGemini({
    systemPrompt: withDynamicPrompts(systemPrompt, dynamicPrompts),
    userMessage,
    responseMimeType: tools ? undefined : "application/json",
    responseSchema,
    tools,
    temperature,
    maxOutputTokens,
  });
  return {
    data: parseJsonObject(result.text),
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
  loadProductVerbiage,
  required,
};
