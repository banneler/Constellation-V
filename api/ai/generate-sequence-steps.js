const { callScopedJson, loadProductVerbiage, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "sequence-generation";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING" },
          delay_days: { type: "INTEGER" },
          subject: { type: "STRING" },
          message: { type: "STRING" },
        },
        required: ["type", "delay_days", "message"],
      },
    },
  },
  required: ["steps"],
};

function generateDynamicExample(stepTypes) {
  const exampleSteps = stepTypes.map((type, index) => ({
    type,
    delay_days: index === 0 ? 0 : index * 2 + 1,
    subject: type === "Email" ? "Example Email Subject for [AccountName]" : "",
    message: type === "Call"
      ? "Objective for the call: Follow up with [FirstName] regarding the previous outreach."
      : type === "LinkedIn"
        ? "Connect with [FirstName] on LinkedIn with a relevant note about [AccountName]."
        : "Write a relevant action for this step using [FirstName] and [AccountName] where useful.",
  }));
  return JSON.stringify({ steps: exampleSteps }, null, 2);
}

const SYSTEM_PROMPT = `You are an expert sales sequence strategist and content writer for Great Plains Communications.
Generate outreach sequences that are practical for enterprise telecommunications sales.
Use only the requested step types. Preserve placeholders: [FirstName], [LastName], [AccountName].
Return only JSON with a single "steps" array.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { sequenceGoal, numSteps, totalDuration, stepTypes, personaPrompt, product_names, industry } = body;
    required(sequenceGoal, "Missing sequenceGoal.");
    required(numSteps, "Missing numSteps.");
    required(totalDuration, "Missing totalDuration.");
    required(stepTypes, "Missing stepTypes.");
    required(personaPrompt, "Missing personaPrompt.");

    const productContext = await loadProductVerbiage(product_names, industry);
    const userMessage = [
      `Sequence goal: ${sequenceGoal}`,
      `Number of steps: ${numSteps}`,
      `Approximate duration: ${totalDuration} days`,
      `Allowed step types only: ${stepTypes.join(", ")}`,
      `Persona and voice: ${personaPrompt}`,
      productContext ? `Product context:\n${productContext}` : "",
      "Each step must include type, delay_days, subject, and message.",
      "For Call, Task, and LinkedIn steps, subject can be empty.",
      `Example JSON structure:\n${generateDynamicExample(stepTypes)}`,
    ].filter(Boolean).join("\n\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.55,
      maxOutputTokens: 4096,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/generate-sequence-steps]", error);
    return sendError(res, error);
  }
};
