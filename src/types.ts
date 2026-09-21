/**
 * Minimal interface for reading lines from a document.
 * Using this instead of vscode.TextDocument directly allows pure unit tests
 * without any VS Code dependency.
 */
export interface LineReader {
    readonly lineCount: number;
    lineAt(index: number): { readonly text: string };
}

/** Parsed representation of a bullet item line e.g. ">> - content" */
export interface BulletMatch {
    chevrons: string;
    content:  string;
}

/** Parsed representation of a numbered item line e.g. ">> 1. content" */
export interface NumberedMatch {
    chevrons: string;
    num:      number;
    content:  string;
}

/** Inclusive line range for a chevron section [startLine, endLine] */
export type SectionRange = [number, number];

/** Extension configuration values read from VS Code settings */
export interface ChevronConfig {
    prefix:              string;
    blankLine:           boolean;
    snippetTrigger:      string;
    autoArchive:         boolean;
    dailyNotesFolder:    string;
    dailyNoteTemplate:   string;
    autoFixNumbering:    boolean;
    defaultNewListType:  string;
    colourPreset:        string;
    anthropicApiKey:     string;
    pasteLinesAsItems:   boolean;
}
