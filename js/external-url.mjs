export function safeExternalUrl(value) {
    try {
        const parsed = new URL(String(value || '').trim());
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}
