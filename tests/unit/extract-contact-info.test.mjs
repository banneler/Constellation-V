import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = new URL('../../', import.meta.url);
const retiredFlash = ['gemini-2', '5-flash'].join('.');
const retiredAlias = ['gemini-2', '0-flash'].join('.');

process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GEMINI_MODEL = retiredFlash;
process.env.GEMINI_FALLBACK_MODEL = retiredAlias;
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
delete process.env.GEMINI_SYNTHESIS_MODEL;

function loadFresh(relativePath) {
    const resolved = require.resolve(relativePath);
    delete require.cache[resolved];
    return require(resolved);
}

const gemini = loadFresh('../../api/_lib/gemini.js');
const handler = loadFresh('../../api/ai/extract-contact-info.js');
const synthesize = loadFresh('../../api/cron/synthesize-ai-profiles.js');

function mockRes() {
    return {
        statusCode: null,
        headers: {},
        body: null,
        ended: false,
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.body = payload;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
}

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    };
}

function geminiPayload(contact) {
    return {
        candidates: [
            {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(contact) }] },
            },
        ],
    };
}

test('shared Gemini config replaces retired model ids with the stock model', () => {
    assert.equal(gemini.GEMINI_STOCK_MODEL, 'gemini-3.7-flash');
    assert.equal(gemini.DEFAULT_MODEL, 'gemini-3.7-flash');
    assert.equal(gemini.FALLBACK_MODEL, 'gemini-3.7-flash');
    assert.equal(gemini.resolveGeminiModel(retiredFlash, 'gemini-3.7-flash'), 'gemini-3.7-flash');
    assert.equal(gemini.resolveGeminiModel('  gemini-3.7-flash  '), 'gemini-3.7-flash');
    assert.equal(synthesize.synthesisModel(), 'gemini-3.7-flash');

    process.env.GEMINI_SYNTHESIS_MODEL = retiredFlash;
    assert.equal(synthesize.synthesisModel(), 'gemini-3.7-flash');
    process.env.GEMINI_SYNTHESIS_MODEL = 'gemini-3.7-flash';
    assert.equal(synthesize.synthesisModel(), 'gemini-3.7-flash');
    delete process.env.GEMINI_SYNTHESIS_MODEL;
});

test('extract-contact-info returns the contact contract from a mocked Gemini image call', async () => {
    const calls = [];
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        calls.push({ url: String(url), options });
        if (String(url).includes('/auth/v1/user')) {
            return jsonResponse(200, { id: 'user-1', email: 'ada@example.com' });
        }
        if (String(url).includes('generativelanguage.googleapis.com')) {
            return jsonResponse(200, geminiPayload({
                first_name: 'Ada',
                last_name: 'Lovelace',
                email: 'ada@analytical.engine',
                phone: '555-0100, 555-0101',
                title: 'Mathematician',
                company: 'Analytical Engines',
            }));
        }
        throw new Error(`Unexpected fetch ${url}`);
    };

    try {
        const res = mockRes();
        await handler({
            method: 'POST',
            headers: { authorization: 'Bearer session-token' },
            body: { image: 'abc\n123' },
        }, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(JSON.parse(res.body), {
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@analytical.engine',
            phone: '555-0100, 555-0101',
            title: 'Mathematician',
            company: 'Analytical Engines',
        });

        const geminiCall = calls.find((call) => call.url.includes('generativelanguage.googleapis.com'));
        assert.ok(geminiCall, 'expected a Gemini request');
        assert.match(geminiCall.url, /\/models\/gemini-3\.7-flash:generateContent/);
        assert.equal(geminiCall.url.includes(retiredFlash), false);
        const payload = JSON.parse(geminiCall.options.body);
        assert.equal(payload.systemInstruction, undefined);
        assert.equal(payload.generationConfig.responseMimeType, 'application/json');
        assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'image/png');
        assert.equal(payload.contents[0].parts[1].inlineData.data, 'abc123');
        assert.match(payload.contents[0].parts[0].text, /business card/);
    } finally {
        global.fetch = originalFetch;
    }
});

test('extract-contact-info preserves auth and rejects a missing image before Gemini', async () => {
    const originalFetch = global.fetch;
    let geminiCalls = 0;
    global.fetch = async (url) => {
        if (String(url).includes('generativelanguage.googleapis.com')) {
            geminiCalls += 1;
        }
        if (String(url).includes('/auth/v1/user')) {
            return jsonResponse(401, { message: 'bad session' });
        }
        throw new Error(`Unexpected fetch ${url}`);
    };

    try {
        const unauthorized = mockRes();
        await handler({
            method: 'POST',
            headers: {},
            body: { image: 'abc' },
        }, unauthorized);
        assert.equal(unauthorized.statusCode, 401);
        assert.match(JSON.parse(unauthorized.body).error, /Authorization/);

        global.fetch = async (url) => {
            if (String(url).includes('/auth/v1/user')) {
                return jsonResponse(200, { id: 'user-1' });
            }
            if (String(url).includes('generativelanguage.googleapis.com')) {
                geminiCalls += 1;
                return jsonResponse(200, geminiPayload({}));
            }
            throw new Error(`Unexpected fetch ${url}`);
        };

        const missing = mockRes();
        await handler({
            method: 'POST',
            headers: { authorization: 'Bearer session-token' },
            body: {},
        }, missing);
        assert.equal(missing.statusCode, 400);
        assert.equal(JSON.parse(missing.body).error, 'Missing image data in request body.');
        assert.equal(geminiCalls, 0);

        const wrongMethod = mockRes();
        await handler({ method: 'GET', headers: {} }, wrongMethod);
        assert.equal(wrongMethod.statusCode, 405);
    } finally {
        global.fetch = originalFetch;
    }
});

test('contacts import calls the Vercel extract-contact-info route', async () => {
    const contactsJs = await readFile(new URL('js/contacts.js', projectRoot), 'utf8');
    const aiMemory = await readFile(new URL('js/ai-memory.js', projectRoot), 'utf8');

    assert.match(contactsJs, /callAiApi\(\s*supabase,\s*'extract-contact-info',\s*\{\s*image:\s*base64Image\s*\}\s*\)/);
    assert.equal(contactsJs.includes("functions.invoke('extract-contact-info'"), false);
    assert.match(aiMemory, /fetch\(`\/api\/ai\/\$\{routeName\}`/);
});

test('JavaScript and Pathfinder Gemini denylists stay aligned', async () => {
    const [jsSource, pySource] = await Promise.all([
        readFile(new URL('api/_lib/gemini.js', projectRoot), 'utf8'),
        readFile(new URL('automation/pathfinder/pathfinder/config.py', projectRoot), 'utf8'),
    ]);
    const modelIds = (source) => [...source.matchAll(/gemini-[a-z0-9.-]+/g)].map((match) => match[0]).sort();
    assert.deepEqual(modelIds(pySource), modelIds(jsSource));
});

test('repository AI paths do not name the retired flash model', () => {
    let output = '';
    try {
        output = execFileSync(
            'rg',
            [
                '-n',
                '--glob', '!node_modules/**',
                '--glob', '!.git/**',
                '--glob', '!api/_lib/gemini.js',
                '--glob', '!automation/pathfinder/pathfinder/config.py',
                retiredFlash,
                '.',
            ],
            { cwd: fileURLToPath(projectRoot), encoding: 'utf8' }
        );
    } catch (error) {
        if (error.status === 1) return;
        throw error;
    }
    assert.fail(`retired model id is still referenced:\n${output}`);
});
