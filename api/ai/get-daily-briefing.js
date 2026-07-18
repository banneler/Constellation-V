const { callScopedJson, required } = require("../_lib/ai-route-helpers");
const { handleOptions, readJsonBody, sendError, sendJson } = require("../_lib/http");
const { getUserFromRequest } = require("../_lib/supabase");

const FUNCTION_ID = "daily-briefing";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    priorities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["title", "reason"],
      },
    },
  },
  required: ["priorities"],
};

const SYSTEM_PROMPT = `You are an expert sales consultant for Great Plains Communications.
Create a daily command-center briefing from CRM data.
Prioritize Cognito buying signals, late-stage/high-MRC deals, and pending tasks.
Return only JSON with a "priorities" array of objects containing "title" and "reason".`;

function formatBriefingData(payload) {
  const { tasks = [], deals = [], cognitoAlerts = [], contacts = [], accounts = [] } = payload || {};
  const findRelatedInfo = (item) => {
    let contact;
    let account;
    if (item.contact_id) {
      contact = contacts.find((c) => c.id === item.contact_id);
      if (contact?.account_id) account = accounts.find((a) => a.id === contact.account_id);
    } else if (item.account_id) {
      account = accounts.find((a) => a.id === item.account_id);
    }
    return { contact, account };
  };

  const formattedTasks = tasks.map((task) => {
    const { contact, account } = findRelatedInfo(task);
    return `- Task: "${task.description}". Due: ${task.due_date}. Linked to: ${contact ? contact.first_name : "No Contact"}, ${account ? account.name : "No Account"}.`;
  }).join("\n") || "No pending tasks.";

  const formattedDeals = deals.map((deal) => {
    const account = accounts.find((a) => a.id === deal.account_id);
    return `- Deal: "${deal.name}" (${account?.name || "Unknown"}) is in "${deal.stage}" with MRC $${deal.mrc || "0"}.`;
  }).join("\n") || "No open deals.";

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const formattedAlerts = cognitoAlerts
    .filter((alert) => alert.status?.toLowerCase() === "new" && new Date(alert.created_at) > sevenDaysAgo)
    .map((alert) => {
      const account = accounts.find((item) => item.id === alert.account_id);
      return `- New Cognito Alert for ${account?.name || "Unknown"}: "${alert.headline}". Details: ${alert.summary || "No description."}`;
    }).join("\n") || "No new Cognito Alerts.";

  return { formattedTasks, formattedDeals, formattedAlerts };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { briefingPayload } = await readJsonBody(req);
    required(briefingPayload, "Missing briefingPayload.");

    const { formattedTasks, formattedDeals, formattedAlerts } = formatBriefingData(briefingPayload);
    const userMessage = [
      "Today's data:",
      `Cognito alerts:\n${formattedAlerts}`,
      `Open deals:\n${formattedDeals}`,
      `Pending tasks:\n${formattedTasks}`,
    ].join("\n\n");

    const { data, model } = await callScopedJson({
      userId: user.id,
      functionId: FUNCTION_ID,
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.35,
      maxOutputTokens: 2048,
    });

    return sendJson(res, 200, { ...data, model });
  } catch (error) {
    console.error("[api/ai/get-daily-briefing]", error);
    return sendError(res, error);
  }
};
