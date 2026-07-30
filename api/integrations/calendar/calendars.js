const { handleOptions, sendError, sendJson } = require("../../_lib/http");
const { getUserFromRequest } = require("../../_lib/supabase");
const {
  assertOrgIntegrationsEnabled,
  getUserIntegration,
  listCalendars,
} = require("../../_lib/nylas");

/** Normalize provider/calendar hex colors to `#RRGGBB` (or null). */
function normalizeHexColor(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) return withHash.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function normalizeCalendar(cal) {
  const id = cal?.id ? String(cal.id) : null;
  if (!id) return null;
  const name = (cal?.name && String(cal.name).trim()) || "Calendar";
  const color =
    normalizeHexColor(cal?.hex_color) ||
    normalizeHexColor(cal?.hexColor) ||
    normalizeHexColor(cal?.color) ||
    null;
  return {
    id,
    name,
    color,
    isPrimary: Boolean(cal?.is_primary ?? cal?.isPrimary),
    readOnly: Boolean(cal?.read_only ?? cal?.readOnly),
    isOwnedByUser: cal?.is_owned_by_user ?? cal?.isOwnedByUser ?? null,
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const { user } = await getUserFromRequest(req);
    await assertOrgIntegrationsEnabled();
    const integration = await getUserIntegration(user.id);
    if (!integration || integration.status !== "connected" || !integration.nylas_grant_id) {
      return sendJson(res, 409, {
        error: "Connect Google or Outlook in User Settings to use calendar.",
        code: "not_connected",
      });
    }

    const url = new URL(req.url, "http://localhost");
    const limitRaw = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const result = await listCalendars(integration.nylas_grant_id, { limit });
    const raw = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
    const calendars = raw.map(normalizeCalendar).filter(Boolean);

    // Prefer writable calendars first; keep primary near the top.
    calendars.sort((a, b) => {
      if (a.readOnly !== b.readOnly) return a.readOnly ? 1 : -1;
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sendJson(res, 200, {
      ok: true,
      provider: integration.provider,
      calendars,
      result,
    });
  } catch (error) {
    console.error("[api/integrations/calendar/calendars]", error);
    return sendError(res, error);
  }
};
