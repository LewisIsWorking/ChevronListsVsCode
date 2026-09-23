import * as vscode from 'vscode';
import { isHeader, parseBullet, parseNumbered, LABEL_RE } from './patterns';
import { getConfig } from './config';

/**
 * Semantic token types contributed by this extension.
 * Must match the names registered in package.json contributes.semanticTokenTypes.
 */
const TOKEN_TYPES = [
    'chevronHeader', 'chevronPrefix', 'chevronNumber', 'chevronContent', 'chevronLabel'
] as const;
type TokenType = typeof TOKEN_TYPES[number];

const TOKEN_TYPE_MAP = new Map<TokenType, number>(
    TOKEN_TYPES.map((t, i) => [t, i])
);

/** Builds the SemanticTokensLegend used by both provider registration and token encoding */
export function buildLegend(): vscode.SemanticTokensLegend {
    return new vscode.SemanticTokensLegend([...TOKEN_TYPES], []);
}

/** Emits chevronContent and chevronLabel tokens for a content region, non-overlapping */
function pushContentWithLabels(
    line:         number,
    contentStart: number,
    content:      string,
    push:         (line: number, start: number, len: number, type: TokenType) => void
): void {
    let cursor = 0;
    for (const match of content.matchAll(LABEL_RE)) {
        const labelStart = match.index!;
        // Push content segment before this label
        if (labelStart > cursor) {
            push(line, contentStart + cursor, labelStart - cursor, 'chevronContent');
        }
        // Push the label itself
        push(line, contentStart + labelStart, match[0].length, 'chevronLabel');
        cursor = labelStart + match[0].length;
    }
    // Push any remaining content after the last label
    if (cursor < content.length) {
        push(line, contentStart + cursor, content.length - cursor, 'chevronContent');
    }
}

/** Provides semantic tokens for all chevron lines in a markdown document */
export class ChevronSemanticTokensProvider
    implements vscode.DocumentSemanticTokensProvider {

    constructor(private readonly legend: vscode.SemanticTokensLegend) {}

    provideDocumentSemanticTokens(
        document: vscode.TextDocument
    ): vscode.SemanticTokens {
        const builder = new vscode.SemanticTokensBuilder(this.legend);
        const { prefix } = getConfig();
        const pushFn = (l: number, s: number, n: number, t: TokenType) => this.push(builder, l, s, n, t);

        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;

            if (isHeader(text)) {
                this.push(builder, i, 0, 2, 'chevronPrefix');
                this.push(builder, i, 2, text.length - 2, 'chevronHeader');
                continue;
            }

            const bullet = parseBullet(text, prefix);
            if (bullet) {
                // Colour ">> " (chevrons + space) as prefix (slate)
                const chevronsAndSpace = bullet.chevrons.length + 1;
                // Colour "- " (prefix char + space) as number (lime) - same role as "1."
                const prefixAndSpace   = prefix.length + 1;
                this.push(builder, i, 0, chevronsAndSpace, 'chevronPrefix');
                this.push(builder, i, chevronsAndSpace, prefixAndSpace, 'chevronNumber');
                if (bullet.content.length > 0) {
                    pushContentWithLabels(i, chevronsAndSpace + prefixAndSpace, bullet.content, pushFn);
                }
                continue;
            }

            const numbered = parseNumbered(text);
            if (numbered) {
                const chevronLen  = numbered.chevrons.length + 1;
                const numStr      = String(numbered.num);
                const dotAndSpace = 2;
                this.push(builder, i, 0, chevronLen, 'chevronPrefix');
                this.push(builder, i, chevronLen, numStr.length, 'chevronNumber');
                this.push(builder, i, chevronLen + numStr.length, dotAndSpace, 'chevronPrefix');
                if (numbered.content.length > 0) {
                    const contentStart = chevronLen + numStr.length + dotAndSpace;
                    pushContentWithLabels(i, contentStart, numbered.content, pushFn);
                }
            }
        }
        return builder.build();
    }

    private push(
        builder: vscode.SemanticTokensBuilder,
        line: number,
        startChar: number,
        length: number,
        type: TokenType
    ): void {
        const typeIndex = TOKEN_TYPE_MAP.get(type);
        if (typeIndex !== undefined && length > 0) {
            builder.push(line, startChar, length, typeIndex, 0);
        }
    }
}
