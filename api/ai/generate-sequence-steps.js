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

const SYSTEM_PROMPT = `You are an expert enterprise sales sequence strategist and copywriter for Great Plains Communications.

Generate practical, multi-touch outreach sequences that create a coherent progression over time. The sequence should feel like a thoughtful campaign, not a stack of disconnected emails. Use reference sequences only to understand preferred cadence, channel mix, and level of detail; do not copy their wording.

Rules:
- Generate exactly the requested number of steps.
- Use only the requested step types.
- Preserve placeholders exactly: [FirstName], [LastName], [AccountName].
- Each step should have a distinct job: open a relevant business issue, create curiosity, add proof/context, handle silence, or prompt a clear next action.
- Do not repeat the same CTA or value proposition across steps.
- Email subjects should be short, specific, and non-spammy.
- Call and Task steps should describe the seller action or objective, not pretend to be customer-facing copy.
- LinkedIn steps should be conversational and shorter than email steps.
- Use product context strategically when provided, but do not stuff product language into every step.
- Delay days should create a realistic cadence across the requested total duration.
- Return only JSON with a single "steps" array.`;

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const body = await readJsonBody(req);
    const { sequenceGoal, numSteps, totalDuration, stepTypes, personaPrompt, product_names, industry, referenceSequences, guidanceMode } = body;
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
      `Mode: ${guidanceMode ? "Guidance Mode - write seller guidance, thought-provoking questions, talk tracks, and topics to cover instead of verbatim customer-facing scripts." : "Script Mode - write customer-ready copy for customer-facing steps and seller objectives for internal steps."}`,
      productContext ? `Product context:\n${productContext}` : "",
      Array.isArray(referenceSequences) && referenceSequences.length > 0
        ? `Reference sequences for cadence and structure only. Do not copy wording:\n${JSON.stringify(referenceSequences, null, 2)}`
        : "",
      "Each step must include type, delay_days, subject, and message.",
      "For Call, Task, and LinkedIn steps, subject can be empty.",
      "The sequence should build logically from first touch through final touch.",
      guidanceMode ? [
        "Guidance Mode instructions:",
        "- The message field should coach the seller on what to cover, what question to ask, and why the touch matters.",
        "- For Email steps, subject should be a suggested theme or short working subject, while message should be guidance bullets or a talk track, not a final email.",
        "- For Call and Task steps, include prep notes, discovery angles, and thought-provoking questions.",
        "- For LinkedIn steps, include the angle and conversational opener guidance rather than exact DM copy.",
        "- Make guidance practical enough that a rep can personalize it quickly."
      ].join("\n") : "",
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
