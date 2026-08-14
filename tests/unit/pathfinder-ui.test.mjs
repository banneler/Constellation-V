import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    applyPathfinderNavigation,
    isPathfinderEnabled
} from '../../js/pathfinder-feature.mjs';

const projectRoot = new URL('../../', import.meta.url);
const orbitronResource = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap';

test('Pathfinder loads the same Orbitron resource required by the Cognito wordmark', async () => {
    const [pathfinderHtml, cognitoHtml] = await Promise.all([
        readFile(new URL('pathfinder.html', projectRoot), 'utf8'),
        readFile(new URL('cognito.html', projectRoot), 'utf8')
    ]);

    assert.equal(cognitoHtml.includes(orbitronResource), true);
    assert.equal(pathfinderHtml.includes(orbitronResource), true);
});

test('Pathfinder navigation remains hidden unless explicitly enabled', () => {
    const classes = new Set(['nav-button', 'hidden']);
    const attributes = new Map([['aria-hidden', 'true']]);
    const nav = {
        classList: {
            toggle(name, force) {
                if (force) classes.add(name);
                else classes.delete(name);
            }
        },
        setAttribute(name, value) {
            attributes.set(name, value);
        }
    };
    const root = { getElementById: (id) => id === 'pathfinder-nav-button' ? nav : null };

    assert.equal(isPathfinderEnabled({ pathfinder_enabled: false }), false);
    assert.equal(isPathfinderEnabled({ pathfinder_enabled: true }), true);
    assert.equal(isPathfinderEnabled({}), false);

    applyPathfinderNavigation(root, false);
    assert.equal(classes.has('hidden'), true);
    assert.equal(attributes.get('aria-hidden'), 'true');

    applyPathfinderNavigation(root, true);
    assert.equal(classes.has('hidden'), false);
    assert.equal(attributes.get('aria-hidden'), 'false');
});
