const { callGemini, parseJsonObject } = require("../_lib/gemini");
const { handleOptions, sendError, sendJson } = require("../_lib/http");
const { encodeEq, supabaseRest } = require("../_lib/supabase");

const SYNTHESIS_MODEL = process.env.GEMINI_SYNTHESIS_MODEL || "gemini-3.1-pro";
const MAX_ROWS_PER_RUN = Number(process.env.AI_PROFILE_SYNTHESIS_LIMIT || 1000);

const SYSTEM_PROMPT = `You synthesize raw user feedback about AI outputs into a durable, personalized system prompt for one specific AI function.

Rules:
- Preserve stable user preferences about tone, structure, product emphasis, and sales style.
- Weight explicit negative feedback higher than positive ratings.
- Prefer newer, repeated, and specific feedback when feedback conflicts.
- Generalize examples; do not quote private customer details or raw feedback verbatim.
- Remove transient, one-off requests that should not become durable behavior.
- Do not infer preferences for other AI functions; keep guidance scoped to the provided function_id.
- Keep the prompt concise, operational, and directly useful for future AI generations.
- Return only strict JSON: { "dynamic_prompt": "..." }.`;

function assertCronAuthorized(req) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV !== "production") return;
    throw Object.assign(new Error("CRON_SECRET is not configured."), { status: 500 });
  }

  const headerSecret = req.headers["x-cron-secret"];
  const auth = req.headers.authorization || "";
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (headerSecret === configured || bearer === configured) return;

  throw Object.assign(new Error("Unauthorized cron request."), { status: 401 });
}

function groupByUserFunction(rows) {
  return rows.reduce((groups, row) => {
    if (!row.user_id) return groups;
    const functionId = String(row.function_id || "legacy-general").trim() || "legacy-general";
    const key = `${row.user_id}::${functionId}`;
    if (!groups.has(key)) groups.set(key, { userId: row.user_id, functionId, rows: [] });
    groups.get(key).rows.push({ ...row, function_id: functionId });
    return groups;
  }, new Map());
}

function compactFeedbackRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    function_id: row.function_id,
    rating: row.rating,
    feedback: row.feedback,
    prompt: String(row.prompt || "").slice(0, 1600),
    response: String(row.response || "").slice(0, 1600),
  }));
}

async function loadExistingPrompt(userId, functionId) {
  const rows = await supabaseRest(
    `user_ai_profiles?user_id=eq.${encodeEq(userId)}&function_id=eq.${encodeEq(functionId)}&select=dynamic_prompt&limit=1`,
    { serviceRole: true }
  );
  return rows?.[0]?.dynamic_prompt || "";
}

async function upsertProfile(userId, functionId, dynamicPrompt) {
  await supabaseRest("user_ai_profiles?on_conflict=user_id,function_id", {
    method: "POST",
    serviceRole: true,
    prefer: "resolution=merge-duplicates",
    body: [{
      user_id: userId,
      function_id: functionId,
      dynamic_prompt: dynamicPrompt,
      updated_at: new Date().toISOString(),
    }],
  });
}

async function markProcessed(rows) {
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return;
  await supabaseRest(`personal_context?id=in.(${ids.map(encodeEq).join(",")})`, {
    method: "PATCH",
    serviceRole: true,
    body: { processed: true },
  });
}

async function synthesizeForUserFunction(userId, functionId, rows) {
  const existingPrompt = await loadExistingPrompt(userId, functionId);
  const userMessage = [
    "Function id:",
    functionId,
    "",
    "Existing dynamic prompt:",
    existingPrompt || "(none yet)",
    "",
    "Unprocessed feedback rows:",
    JSON.stringify(compactFeedbackRows(rows), null, 2),
  ].join("\n");

  const result = await callGemini({
    model: SYNTHESIS_MODEL,
    disableFallback: true,
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    responseMimeType: "application/json",
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  const parsed = parseJsonObject(result.text);
  const dynamicPrompt = String(parsed.dynamic_prompt || "").trim();
  if (!dynamicPrompt) {
    throw new Error("Gemini synthesis returned an empty dynamic_prompt.");
  }

  await upsertProfile(userId, functionId, dynamicPrompt);
  await markProcessed(rows);
  return { user_id: userId, function_id: functionId, processed: rows.length, model: result.model };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!["GET", "POST"].includes(req.method)) return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    assertCronAuthorized(req);
    const rows = await supabaseRest(
      `personal_context?processed=eq.false&rating=not.is.null&select=id,user_id,function_id,prompt,response,rating,feedback,created_at&order=created_at.asc&limit=${MAX_ROWS_PER_RUN}`,
      { serviceRole: true }
    );

    const groups = groupByUserFunction(rows || []);
    const results = [];
    const failures = [];

    for (const { userId, functionId, rows: userRows } of groups.values()) {
      try {
        results.push(await synthesizeForUserFunction(userId, functionId, userRows));
      } catch (error) {
        console.error("[api/cron/synthesize-ai-profiles] user/function failed", userId, functionId, error);
        failures.push({
          user_id: userId,
          function_id: functionId,
          rows: userRows.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return sendJson(res, failures.length ? 207 : 200, {
      scanned: rows?.length || 0,
      profiles_processed: results.length,
      results,
      failures,
    });
  } catch (error) {
    console.error("[api/cron/synthesize-ai-profiles]", error);
    return sendError(res, error);
  }
};
