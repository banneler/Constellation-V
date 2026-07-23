const { handleOptions, readJsonBody, sendError, sendJson } = require("../../_lib/http");
const { encodeEq, getUserFromRequest, supabaseRest } = require("../../_lib/supabase");

const LONG_BAN_DURATION = "876000h"; // 100 years; keeps the auth user for audit/history.

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

async function loadUserQuota(userId) {
  const rows = await supabaseRest(
    `user_quotas?user_id=eq.${encodeEq(userId)}&select=user_id,full_name,is_manager,deactivated_at&limit=1`,
    { serviceRole: true }
  );
  return rows?.[0] || null;
}

function isAdminFromMetadata(user) {
  return user?.user_metadata?.is_admin === true || user?.app_metadata?.is_admin === true;
}

async function assertManagerOrAdmin(user) {
  const quota = await loadUserQuota(user.id);
  const allowed = quota?.is_manager === true || isAdminFromMetadata(user);
  if (!allowed) {
    throw Object.assign(new Error("Only managers or admins can change user activation status."), { status: 403 });
  }
  if (quota?.deactivated_at) {
    throw Object.assign(new Error("Your account is deactivated."), { status: 403 });
  }
  return quota;
}

async function patchUserQuota(userId, body) {
  const rows = await supabaseRest(`user_quotas?user_id=eq.${encodeEq(userId)}&select=user_id`, {
    method: "PATCH",
    serviceRole: true,
    prefer: "return=representation",
    body,
  });

  if (rows?.length) return rows[0];

  const inserted = await supabaseRest("user_quotas?select=user_id", {
    method: "POST",
    serviceRole: true,
    prefer: "return=representation",
    body: { user_id: userId, ...body },
  });
  return inserted?.[0] || null;
}

async function updateAuthBan(userId, banDuration) {
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ban_duration: banDuration }),
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
    const message = data?.msg || data?.message || data?.error || text || "Supabase Auth user update failed.";
    throw Object.assign(new Error(message), { status: response.status, details: data });
  }

  return data;
}

function normalizeAction(action) {
  const value = String(action || "").trim().toLowerCase();
  if (value !== "deactivate" && value !== "reactivate") {
    throw Object.assign(new Error("Action must be deactivate or reactivate."), { status: 400 });
  }
  return value;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const { user: requester } = await getUserFromRequest(req);
    await assertManagerOrAdmin(requester);

    const body = await readJsonBody(req);
    const targetUserId = String(body.targetUserId || "").trim();
    const action = normalizeAction(body.action);
    const reason = String(body.reason || "").trim().slice(0, 1000);

    if (!targetUserId) {
      throw Object.assign(new Error("Target user is required."), { status: 400 });
    }
    if (targetUserId === requester.id) {
      throw Object.assign(new Error("You cannot change activation status for your own account."), { status: 400 });
    }

    if (action === "deactivate") {
      const deactivatedAt = new Date().toISOString();
      await patchUserQuota(targetUserId, {
        deactivated_at: deactivatedAt,
        deactivated_by: requester.id,
        deactivation_reason: reason || null,
        is_manager: false,
        exclude_from_reporting: true,
        show_in_pipeline: false,
      });
      await updateAuthBan(targetUserId, LONG_BAN_DURATION);
      sendJson(res, 200, { ok: true, action, targetUserId, deactivatedAt });
      return;
    }

    await patchUserQuota(targetUserId, {
      deactivated_at: null,
      deactivated_by: null,
      deactivation_reason: null,
    });
    await updateAuthBan(targetUserId, "none");
    sendJson(res, 200, { ok: true, action, targetUserId });
  } catch (error) {
    sendError(res, error);
  }
};
