/**
 * Strategic Account OS — shared CRM contact helpers.
 */

/**
 * @param {string | number | null | undefined} id
 * @param {Array<{ id?: string | number, first_name?: string, last_name?: string, title?: string, job_title?: string }>} contacts
 * @returns {object | null}
 */
export function resolveContactById(id, contacts) {
    if (id == null || id === '') return null;
    const idStr = String(id);
    if (!Array.isArray(contacts)) return null;
    return contacts.find((contact) => contact != null && String(contact.id) === idStr) ?? null;
}

/**
 * @param {object | null | undefined} contact
 * @param {{ fallback?: string }} [options]
 * @returns {string}
 */
export function formatContactLabel(contact, options = {}) {
    const fallback = options.fallback ?? 'Unknown contact';
    if (!contact) return fallback;
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    const title = contact.title || contact.job_title || '';
    if (name && title) return `${name} — ${title}`;
    return name || title || fallback;
}
