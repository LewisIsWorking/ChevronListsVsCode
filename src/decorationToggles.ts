import * as vscode from 'vscode';
import { updateBadgeDecorations } from './itemCountBadge';
import { updateGoalDecorations } from './goalProgressDecoration';
import { updateSummaryDecorations } from './sectionSummaryDecoration';
import { updateChecklistProgressDecorations } from './checklistProgressDecoration';
import { updateAgeDecorations } from './ageHighlightDecoration';

interface DecorationState {
    summary:    boolean;
    checklist:  boolean;
    wordGoal:   boolean;
    badge:      boolean;
    ageHighlight: boolean;
}

const state: DecorationState = {
    summary:      true,
    checklist:    true,
    wordGoal:     true,
    badge:        false,  // off by default - section summary already shows item count
    ageHighlight: true,
};

function refresh(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }
    if (state.summary)     { updateSummaryDecorations(editor); }
    if (state.checklist)   { updateChecklistProgressDecorations(editor); }
    if (state.wordGoal)    { updateGoalDecorations(editor); }
    if (state.badge)       { updateBadgeDecorations(editor); }
    if (state.ageHighlight){ updateAgeDecorations(editor); }
    // Note: when a decoration is toggled OFF, its previously-applied decorations remain
    // until the editor is refreshed. The previous code attempted to clear them by creating
    // a throwaway TextEditorDecorationType, but that leaked a type per toggle and never
    // actually cleared anything (a brand-new type has no decorations to clear).
}

function toggle(key: keyof DecorationState, label: string): void {
    state[key] = !state[key];
    refresh();
    vscode.window.showInformationMessage(`CL: ${label} ${state[key] ? 'enabled' : 'disabled'}`);
}

export const onToggleSummaryDecoration    = () => toggle('summary',     'Section Summary');
export const onToggleChecklistBar         = () => toggle('checklist',   'Checklist Progress Bar');
export const onToggleWordGoalBar          = () => toggle('wordGoal',    'Word Goal Bar');
export const onToggleAgeHighlight         = () => toggle('ageHighlight','Age Highlight');

export function onToggleAllDecorations(): void {
    const anyOn = Object.values(state).some(v => v);
    (Object.keys(state) as Array<keyof DecorationState>).forEach(k => { state[k] = !anyOn; });
    refresh();
    vscode.window.showInformationMessage(`CL: All decorations ${!anyOn ? 'enabled' : 'disabled'}`);
}

/** Returns the current decoration state - used by update functions to skip disabled ones */
export function getDecorationState(): Readonly<DecorationState> { return state; }
