import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeExternalUrl } from '../../js/external-url.mjs';

const projectRoot = new URL('../../', import.meta.url);
const migrationUrl = new URL(
    'supabase/migrations/20260820201500_add_contact_profile_urls.sql',
    projectRoot
);

test('public profile URLs allow only absolute HTTP(S) links', () => {
    assert.equal(
        safeExternalUrl(' https://example.com/leadership '),
        'https://example.com/leadership'
    );
    assert.equal(safeExternalUrl('http://example.com/profile'), 'http://example.com/profile');
    assert.equal(safeExternalUrl('javascript:alert(1)'), '');
    assert.equal(safeExternalUrl('data:text/html,unsafe'), '');
    assert.equal(safeExternalUrl('ftp://example.com/profile'), '');
    assert.equal(safeExternalUrl('example.com/profile'), '');
});

test('Contacts form renders and persists the generic public profile field safely', async () => {
    const [html, contactsJs] = await Promise.all([
        readFile(new URL('contacts.html', projectRoot), 'utf8'),
        readFile(new URL('js/contacts.js', projectRoot), 'utf8')
    ]);

    assert.match(html, /id="contact-profile-url"[^>]*type="url"|type="url"[^>]*id="contact-profile-url"/);
    assert.match(html, /id="contact-profile-url-link"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    assert.match(contactsJs, /safeExternalUrl\(contact\.profile_url\)/);
    assert.match(contactsJs, /profile_url:\s*profileUrl/);
    assert.match(contactsJs, /Public profile URL must start with http:\/\/ or https:\/\//);
    assert.equal(html.includes('linkedin_profile_url'), false);
});

test('successor migration maps Pathfinder profiles without overwriting user URLs', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    assert.match(migration, /add column if not exists profile_url text/i);
    assert.match(migration, /candidate\.status = 'approved'/);
    assert.match(migration, /candidate\.crm_contact_id = contact\.id/);
    assert.match(migration, /nullif\(trim\(contact\.profile_url\), ''\) is null/);
    assert.match(
        migration,
        /set profile_url = nullif\(trim\(candidate\.profile_url\), ''\)[\s\S]*where contact\.id = existing_contact_id[\s\S]*nullif\(trim\(contact\.profile_url\), ''\) is null/
    );
    assert.match(
        migration,
        /title,\s*profile_url,\s*account_id[\s\S]*trim\(candidate\.title\),\s*nullif\(trim\(candidate\.profile_url\), ''\)/
    );
    assert.match(migration, /pathfinder_can_access_owner\(candidate\.user_id\)/);
    assert.equal(migration.includes('linkedin_profile_url'), false);
});
