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

const SYSTEM_PROMPT = `You are an executive sales command-center advisor for Great Plains Communications.

Create a concise daily briefing that tells the seller where executive attention should go today. This is not a task list. It is a prioritization engine that weighs buying signals, pipeline risk, relationship momentum, sequence timing, and stale account activity.

Prioritize:
1. Fresh Cognito buying signals tied to named accounts.
2. Late-stage, high-MRC, committed, or time-sensitive deals.
3. Accounts with recent activity that suggests momentum, risk, or an executive follow-up opportunity.
4. Due sequence steps only when the next touch matters strategically.
5. Overdue tasks only when they protect revenue, executive access, or a customer commitment.
6. Nurture accounts only when there is no stronger active opportunity.

Rules:
- Do not simply summarize every task, deal, or sequence step.
- Prefer 3 to 5 priorities. If the data is light, return fewer.
- Each priority title should be an action-oriented executive headline.
- Each reason should explain why it matters now and what context justifies the priority.
- Avoid generic advice and avoid inventing facts.
- Return only JSON with a "priorities" array of objects containing "title" and "reason".`;

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "unknown date";
}

function money(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? `$${number.toLocaleString()}` : "$0";
}

function truncate(value, max = 500) {
  const text = value == null ? "" : String(value).trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}

function formatBriefingData(payload) {
  const {
    tasks = [],
    deals = [],
    cognitoAlerts = [],
    nurtureAccounts = [],
    activities = [],
    sequenceSteps = [],
    contacts = [],
    accounts = [],
    sequences = [],
    sequence_steps = [],
  } = payload || {};
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

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const formattedTasks = tasks
    .filter((task) => String(task.status || "").toLowerCase() === "pending")
    .sort((a, b) => (toDate(a.due_date)?.getTime() || 0) - (toDate(b.due_date)?.getTime() || 0))
    .slice(0, 12)
    .map((task) => {
    const { contact, account } = findRelatedInfo(task);
    const due = toDate(task.due_date);
    const urgency = due && due < startOfToday ? "overdue" : "pending";
    return `- ${urgency}: "${truncate(task.description, 220)}". Due: ${formatDate(task.due_date)}. Linked to: ${contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "No Contact"}, ${account ? account.name : "No Account"}.`;
  }).join("\n") || "No pending tasks.";

  const stageWeight = { proposal: 4, negotiation: 5, contract: 5, closed: 1, prospecting: 1, discovery: 2 };
  const formattedDeals = deals
    .slice()
    .sort((a, b) => {
      const aStage = stageWeight[String(a.stage || "").toLowerCase()] || 3;
      const bStage = stageWeight[String(b.stage || "").toLowerCase()] || 3;
      return (bStage * 100000 + Number(b.mrc || 0)) - (aStage * 100000 + Number(a.mrc || 0));
    })
    .slice(0, 15)
    .map((deal) => {
    const account = accounts.find((a) => a.id === deal.account_id);
    return `- "${deal.name}" (${account?.name || "Unknown"}) is in "${deal.stage || "Unknown"}" with MRC ${money(deal.mrc)}${deal.close_month ? `, close month ${deal.close_month}` : ""}${deal.is_committed ? ", committed" : ""}${deal.products ? `, products: ${truncate(deal.products, 180)}` : ""}.`;
  }).join("\n") || "No open deals.";

  const formattedAlerts = cognitoAlerts
    .filter((alert) => alert.status?.toLowerCase() === "new" && new Date(alert.created_at) > sevenDaysAgo)
    .map((alert) => {
      const account = accounts.find((item) => item.id === alert.account_id);
      return `- New Cognito Alert for ${account?.name || "Unknown"}: "${truncate(alert.headline, 180)}". Details: ${truncate(alert.summary || "No description.", 350)}`;
    }).join("\n") || "No new Cognito Alerts.";

  const formattedSequences = sequenceSteps
    .slice(0, 12)
    .map((enrollment) => {
      const contact = contacts.find((item) => item.id === enrollment.contact_id);
      const account = contact?.account_id ? accounts.find((item) => item.id === contact.account_id) : null;
      const sequence = sequences.find((item) => item.id === enrollment.sequence_id);
      const step = sequence_steps.find((item) => item.sequence_id === enrollment.sequence_id && item.step_number === enrollment.current_step_number);
      return `- ${sequence?.name || "Sequence"} step ${enrollment.current_step_number || "?"} due ${formatDate(enrollment.next_step_due_date)} for ${contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Unknown Contact"} at ${account?.name || "Unknown Account"}${step?.type ? ` (${step.type})` : ""}: ${truncate(step?.subject || step?.message || "", 220)}`;
    }).join("\n") || "No due sequence steps.";

  const formattedActivities = activities
    .slice()
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))
    .filter((activity) => {
      const date = toDate(activity.date);
      return !date || date >= thirtyDaysAgo;
    })
    .slice(0, 18)
    .map((activity) => {
      const { contact, account } = findRelatedInfo(activity);
      const contactName = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "Account-Level";
      return `- [${formatDate(activity.date)}] ${activity.type || "Activity"} with ${contactName} at ${account?.name || "Unknown Account"}: ${truncate(activity.description || activity.subject, 350)}`;
    }).join("\n") || "No recent activity in the last 30 days.";

  const formattedNurtureAccounts = nurtureAccounts
    .slice(0, 12)
    .map((account) => `- ${account.name}${account.tier ? ` (${account.tier})` : ""}${account.industry ? `, ${account.industry}` : ""}`)
    .join("\n") || "No nurture accounts.";

  return {
    formattedTasks,
    formattedDeals,
    formattedAlerts,
    formattedSequences,
    formattedActivities,
    formattedNurtureAccounts,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const { user } = await getUserFromRequest(req);
    const { briefingPayload } = await readJsonBody(req);
    required(briefingPayload, "Missing briefingPayload.");

    const {
      formattedTasks,
      formattedDeals,
      formattedAlerts,
      formattedSequences,
      formattedActivities,
      formattedNurtureAccounts,
    } = formatBriefingData(briefingPayload);
    const userMessage = [
      "Today's data:",
      `Cognito alerts:\n${formattedAlerts}`,
      `Open deals:\n${formattedDeals}`,
      `Recent account activity:\n${formattedActivities}`,
      `Due sequence touches:\n${formattedSequences}`,
      `High-urgency pending tasks:\n${formattedTasks}`,
      `Nurture accounts:\n${formattedNurtureAccounts}`,
      "",
      "Return only the priorities worth executive attention today. Do not list every input item.",
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
