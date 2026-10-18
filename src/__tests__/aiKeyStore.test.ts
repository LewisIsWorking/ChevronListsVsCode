/**
 * The Anthropic API key lives in VS Code secret storage, not settings.json,
 * and Rewrite Item shares the other AI commands' request.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as vscode from 'vscode';
import { openEditor, deactivate } from './helpers/editorHarness';
import { initAiKeyStore, getApiKey, onSetApiKey, onExpandItem } from '../aiCommands';
import { onRewriteItem } from '../rewriteItemCommands';

const mock = vscode as unknown as {
    __reset(): void;
    __setConfig(key: string, value: unknown): void;
    recorded: { info: string[]; warning: string[]; error: string[] };
    queued: { inputBox: (string | undefined)[] };
    workspace: { getConfiguration(s: string): { get<T>(k: string): T } };
};

/** An in-memory SecretStorage */
function fakeSecrets(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        get: (k: string) => Promise.resolve(values.get(k)),
        store: (k: string, v: string) => { values.set(k, v); return Promise.resolve(); },
        delete: (k: string) => { values.delete(k); return Promise.resolve(); },
        onDidChange: () => ({ dispose() {} }),
    };
}

const realFetch = globalThis.fetch;
const realEnvKey = process.env.ANTHROPIC_API_KEY;
const KEY = 'chevron-lists.anthropicApiKey';

beforeEach(() => { mock.__reset(); deactivate(); delete process.env.ANTHROPIC_API_KEY; });
afterEach(() => {
    globalThis.fetch = realFetch;
    if (realEnvKey === undefined) { delete process.env.ANTHROPIC_API_KEY; } else { process.env.ANTHROPIC_API_KEY = realEnvKey; }
    // Module state is shared between test files: leave an empty store behind
    initAiKeyStore(fakeSecrets() as unknown as vscode.SecretStorage);
});

function replyWith(text: string, seen?: (headers: Record<string, string>) => void) {
    globalThis.fetch = ((_u: string, init: { headers: Record<string, string> }) => {
        seen?.(init.headers);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ type: 'text', text }] }) });
    }) as unknown as typeof fetch;
}

describe('API key storage', () => {
    it('prefers secret storage, then the old setting, then ANTHROPIC_API_KEY', async () => {
        const secrets = fakeSecrets({ [KEY]: 'from-secrets' });
        initAiKeyStore(secrets as unknown as vscode.SecretStorage);
        mock.__setConfig(KEY, 'from-setting');
        process.env.ANTHROPIC_API_KEY = 'from-env';
        expect(await getApiKey()).toBe('from-secrets');
        secrets.values.clear();
        expect(await getApiKey()).toBe('from-setting');
        mock.__setConfig(KEY, '');
        expect(await getApiKey()).toBe('from-env');
        delete process.env.ANTHROPIC_API_KEY;
        expect(await getApiKey()).toBeUndefined();
    });

    it('Set Anthropic API Key stores the key and clears the plain-text setting', async () => {
        // The key used to sit in settings.json, where Settings Sync or a commit could carry it off.
        const secrets = fakeSecrets();
        initAiKeyStore(secrets as unknown as vscode.SecretStorage);
        mock.__setConfig(KEY, 'old-plain-key');
        mock.queued.inputBox.push('  new-key  ');
        await onSetApiKey();
        expect(secrets.values.get(KEY)).toBe('new-key');
        expect(mock.workspace.getConfiguration('chevron-lists').get<string>('anthropicApiKey')).toBeUndefined();
        expect(mock.recorded.info.at(-1)).toBe('CL: API key saved');
    });

    it('a blank key removes it, and cancelling changes nothing', async () => {
        const secrets = fakeSecrets({ [KEY]: 'k' });
        initAiKeyStore(secrets as unknown as vscode.SecretStorage);
        mock.queued.inputBox.push(undefined);
        await onSetApiKey();
        expect(secrets.values.get(KEY)).toBe('k');
        mock.queued.inputBox.push('');
        await onSetApiKey();
        expect(secrets.values.has(KEY)).toBe(false);
        expect(mock.recorded.info.at(-1)).toBe('CL: API key removed');
    });

    it('requests use the stored key', async () => {
        initAiKeyStore(fakeSecrets({ [KEY]: 'secret-key' }) as unknown as vscode.SecretStorage);
        openEditor(['> A', '>> - a'], { cursor: 1 });
        let sentKey = '';
        replyWith('one', h => { sentKey = h['x-api-key']; });
        await onExpandItem();
        expect(sentKey).toBe('secret-key');
    });

    it('with no key anywhere, says how to set one', async () => {
        openEditor(['> A', '>> - a'], { cursor: 1 });
        await onExpandItem();
        expect(mock.recorded.error.at(-1)).toBe('CL: No API key - run CL: Set Anthropic API Key');
    });
});

describe('Rewrite Item', () => {
    it('reports an HTTP error instead of "AI returned no content"', async () => {
        mock.__setConfig(KEY, 'bad-key');
        const h = openEditor(['> A', '>> - messy item'], { cursor: 1 });
        globalThis.fetch = (() => Promise.resolve({
            ok: false, status: 401, text: () => Promise.resolve('invalid x-api-key'),
        })) as unknown as typeof fetch;
        await onRewriteItem();
        expect(h.lines()).toEqual(['> A', '>> - messy item']);
        expect(mock.recorded.error.at(-1)).toBe('CL: AI request failed - Anthropic API error 401: invalid x-api-key');
    });

    it('rewrites the item through the shared request, keeping its markers', async () => {
        mock.__setConfig(KEY, 'k');
        const h = openEditor(['> A', '>> 2. messy item'], { cursor: 1 });
        globalThis.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve({
            content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' Tidy item \n' }],
        }) })) as unknown as typeof fetch;
        await onRewriteItem();
        expect(h.lines()).toEqual(['> A', '>> 2. Tidy item']);
    });

    it('warns when there is no key', async () => {
        openEditor(['> A', '>> - item'], { cursor: 1 });
        await onRewriteItem();
        expect(mock.recorded.warning.at(-1)).toBe('CL: Run CL: Set Anthropic API Key to use AI commands');
    });
});
