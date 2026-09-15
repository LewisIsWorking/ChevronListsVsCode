import * as vscode from 'vscode';
import type { ChevronConfig } from './types';

/** Reads the extension's configuration from VS Code settings */
export function getConfig(): ChevronConfig {
    const cfg = vscode.workspace.getConfiguration('chevron-lists');
    return {
        prefix:          cfg.get<string>('listPrefix', '-'),
        blankLine:       cfg.get<boolean>('blankLineAfterHeader', false),
        snippetTrigger:  cfg.get<string>('snippetTrigger', 'tab'),
        autoArchive:      cfg.get<boolean>('autoArchive', false),
        dailyNotesFolder:    cfg.get<string>('dailyNotesFolder', ''),
        dailyNoteTemplate:   cfg.get<string>('dailyNoteTemplate', ''),
        autoFixNumbering:    cfg.get<boolean>('autoFixNumbering', true),
        defaultNewListType:  cfg.get<string>('defaultNewListType', 'unordered'),
        colourPreset:        cfg.get<string>('colourPreset', 'default'),
        anthropicApiKey:     cfg.get<string>('anthropicApiKey', ''),
        pasteLinesAsItems:   cfg.get<boolean>('pasteLinesAsItems', true),
    };
}
