import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, isHeader, formatDate, nextWeekday, addMonths } from './patterns';
import { extractTags } from './tagParser';
import { uniqueMentions } from './mentionParser';

// ── Tag completion (#) ────────────────────────────────────────────────────────

/** Provides #tag completions from tags already in the file, sorted by frequency */
export class ChevronTagCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const prefix   = lineText.slice(0, position.character);
        if (!prefix.endsWith('#')) { return []; }

        const { prefix: listPrefix } = getConfig();
        const freq = new Map<string, number>();
        for (let i = 0; i < document.lineCount; i++) {
            const t = document.lineAt(i).text;
            const bullet  = parseBullet(t, listPrefix);
            const numbered = parseNumbered(t);
            const content  = bullet?.content ?? numbered?.content ?? null;
            if (!content) { continue; }
            for (const tag of extractTags(content)) {
                freq.set(tag, (freq.get(tag) ?? 0) + 1);
            }
        }
        return [...freq.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => {
                const item = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Value);
                item.detail      = `#${tag} — used ${count}×`;
                item.sortText    = String(1000 - count).padStart(4, '0');
                item.insertText  = tag;
                return item;
            });
    }
}

// ── Mention completion (@) ────────────────────────────────────────────────────

/** Provides @mention completions from names already in the file */
export class ChevronMentionCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const prefix   = lineText.slice(0, position.character);
        // Only trigger for @ that isn't a date pattern
        if (!prefix.endsWith('@') || /\d$/.test(prefix.slice(0, -1))) { return []; }

        const { prefix: listPrefix } = getConfig();
        const names = uniqueMentions(document, listPrefix);
        return names.map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.User);
            item.detail     = `@${name}`;
            item.insertText = name;
            return item;
        });
    }
}

// ── Section link completion ([[) ──────────────────────────────────────────────

/** Provides [[SectionName]] completions from headers in the file */
export class ChevronLinkCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const prefix   = lineText.slice(0, position.character);
        if (!prefix.endsWith('[[')) { return []; }

        const headers: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const t = document.lineAt(i).text;
            if (isHeader(t)) { headers.push(t.replace(/^> /, '').trim()); }
        }
        return headers.map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Reference);
            item.detail     = `[[${name}]]`;
            item.insertText = new vscode.SnippetString(`${name}]]`);
            return item;
        });
    }
}

// ── Priority completion (!) ───────────────────────────────────────────────────

/** Provides !,!!,!!! priority completions */
export class ChevronPriorityCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const prefix   = lineText.slice(0, position.character);
        if (!prefix.endsWith('!')) { return []; }

        const priorities = [
            { label: '!',   detail: 'Low priority',    sort: '1' },
            { label: '!!',  detail: 'Medium priority',  sort: '2' },
            { label: '!!!', detail: 'High priority',    sort: '3' },
        ];
        return priorities.map(p => {
            const item = new vscode.CompletionItem(p.label, vscode.CompletionItemKind.Enum);
            item.detail    = p.detail;
            item.sortText  = p.sort;
            item.insertText = p.label.slice(1); // already typed first !
            return item;
        });
    }
}

// ── Date completion (@YYYY) ───────────────────────────────────────────────────

/** Provides smart date completions after @ */
export class ChevronDateCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const prefix   = lineText.slice(0, position.character);
        if (!prefix.endsWith('@')) { return []; }

        const today     = new Date();
        const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const nextWeek  = new Date(today); nextWeek.setDate(today.getDate() + 7);
        const nextMonth = addMonths(today, 1);   // setMonth overflowed the 29th-31st

        const suggestions = [
            { label: 'today',      date: today,              sort: '1' },
            { label: 'tomorrow',   date: tomorrow,           sort: '2' },
            { label: 'next Friday',date: nextWeekday(5),     sort: '3' },
            { label: 'next week',  date: nextWeek,           sort: '4' },
            { label: 'next month', date: nextMonth,          sort: '5' },
        ];

        return suggestions.map(s => {
            const dateStr = formatDate(s.date);
            const item    = new vscode.CompletionItem(`${s.label} (${dateStr})`, vscode.CompletionItemKind.Value);
            item.detail     = dateStr;
            item.sortText   = s.sort;
            item.insertText = dateStr;
            return item;
        });
    }
}

// ChevronEstimateCompletionProvider and ChevronRatingCompletionProvider
// have been moved to completionProvidersExtra.ts to keep this file under 200 lines.
