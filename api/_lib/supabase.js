function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`${name} is not configured.`), { status: 500 });
  }
  return value;
}

function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL").replace(/\/$/, "");
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = typeof value === "string" ? value.match(/^Bearer\s+(.+)$/i) : null;
  if (!match) {
    throw Object.assign(new Error("Missing Authorization bearer token."), { status: 401 });
  }
  return match[1];
}

function encodeEq(value) {
  return encodeURIComponent(String(value));
}

async function getUserFromRequest(req) {
  const token = getBearerToken(req);
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: requireEnv("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw Object.assign(new Error("Invalid or expired Supabase session."), { status: 401 });
  }

  const user = await response.json();
  if (!user?.id) {
    throw Object.assign(new Error("Supabase session did not include a user id."), { status: 401 });
  }

  return { token, user };
}

async function supabaseRest(path, options = {}) {
  const serviceRole = Boolean(options.serviceRole);
  const apiKey = serviceRole ? requireEnv("SUPABASE_SERVICE_ROLE_KEY") : requireEnv("SUPABASE_ANON_KEY");
  const authToken = serviceRole ? apiKey : options.token;
  if (!authToken) {
    throw Object.assign(new Error("Missing Supabase REST auth token."), { status: 401 });
  }

  const response = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error || text || "Supabase REST request failed.";
    throw Object.assign(new Error(message), { status: response.status, details: data });
  }

  return data;
}

async function getDynamicPrompt(userId) {
  const rows = await supabaseRest(
    `user_ai_profiles?user_id=eq.${encodeEq(userId)}&function_id=eq.global&select=dynamic_prompt&limit=1`,
    { serviceRole: true }
  );
  return rows?.[0]?.dynamic_prompt ? String(rows[0].dynamic_prompt) : "";
}

async function getDynamicPrompts(userId, functionId) {
  const scopedFunctionId = normalizeFunctionId(functionId);
  const rows = await supabaseRest(
    `user_ai_profiles?user_id=eq.${encodeEq(userId)}&function_id=in.(global,${encodeEq(scopedFunctionId)})&select=function_id,dynamic_prompt`,
    { serviceRole: true }
  );
  const prompts = { globalPrompt: "", functionPrompt: "", functionId: scopedFunctionId };
  for (const row of rows || []) {
    const prompt = row?.dynamic_prompt ? String(row.dynamic_prompt) : "";
    if (row?.function_id === "global") prompts.globalPrompt = prompt;
    if (row?.function_id === scopedFunctionId) prompts.functionPrompt = prompt;
  }
  return prompts;
}

function normalizeFunctionId(functionId) {
  return String(functionId || "legacy-general").trim() || "legacy-general";
}

async function createPersonalContext(userId, prompt, responseText, functionId) {
  const rows = await supabaseRest("personal_context?select=id", {
    method: "POST",
    serviceRole: true,
    prefer: "return=representation",
    body: {
      user_id: userId,
      function_id: normalizeFunctionId(functionId),
      prompt: String(prompt || "").slice(0, 20000),
      response: String(responseText || "").slice(0, 20000),
      processed: false,
    },
  });
  return rows?.[0]?.id || null;
}

module.exports = {
  createPersonalContext,
  encodeEq,
  getDynamicPrompt,
  getDynamicPrompts,
  getUserFromRequest,
  normalizeFunctionId,
  supabaseRest,
};
