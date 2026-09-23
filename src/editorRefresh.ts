/**
 * editorRefresh.ts
 * Centralises all per-editor decoration and diagnostic update calls.
 * Called from extension.ts event handlers - one import, one call.
 */
import * as vscode from 'vscode';
import { getConfig } from './config';
import { updateDecorations } from './decorationProvider';
import { updateStatusBar } from './statusBar';
import { updateOverdueStatusBar } from './overdueStatusBar';
import { updateBadgeDecorations } from './itemCountBadge';
import { updateGoalDecorations } from './goalProgressDecoration';
import { updateAgeDecorations } from './ageHighlightDecoration';
import { updateSummaryDecorations } from './sectionSummaryDecoration';
import { updateChecklistProgressDecorations } from './checklistProgressDecoration';
import { updateDiagnostics } from './diagnosticProvider';
import { updateDueDateDiagnostics } from './dueDateCommands';
import { updateWordGoalDiagnostics } from './wordGoalCommands';
import { updateExpiryDiagnostics, getExpiryDiagCollection } from './expiryDiagnostics';
import { updateHeatMapDecorations } from './heatMapDecoration';
import { updateSectionColourDecorations } from './sectionColourDecoration';
import { updateWordGoalNudge } from './wordGoalNudge';
import { updateStickyHeader } from './stickyHeaderDecoration';
import { applyOverdueEscalation } from './overdueEscalation';
import { updateUrgencyDecorations } from './urgencyDecoration';
import { updatePriorityDecorations } from './priorityDecoration';
import { updateColourPrefixDecorations } from './colourPrefixDecoration';
import { updateFocusDecoration } from './dimDecoration';
import { updateDueSoonDecorations } from './dueSoonDecoration';

export interface DiagCollections {
    dueDateDiags:   vscode.DiagnosticCollection;
}

/** Refreshes all decorations, status bar items, and diagnostics for the given editor */
export function refreshEditor(
    editor: vscode.TextEditor | undefined,
    diags: DiagCollections
): void {
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix } = getConfig();
    updateDecorations(editor);
    updateStatusBar(editor);
    updateOverdueStatusBar(editor);
    updateDiagnostics(editor.document);
    updateDueDateDiagnostics(editor.document, diags.dueDateDiags, prefix);
    updateWordGoalDiagnostics(editor.document, prefix);
    updateExpiryDiagnostics(editor.document, getExpiryDiagCollection(), prefix);
    updateHeatMapDecorations(editor);
    updateSectionColourDecorations(editor);
    updateWordGoalNudge(editor);
    updateStickyHeader(editor);
    applyOverdueEscalation(editor);
    updateUrgencyDecorations(editor);
    updatePriorityDecorations(editor);
    updateColourPrefixDecorations(editor);
    updateFocusDecoration(editor);
    updateDueSoonDecorations(editor);
    updateBadgeDecorations(editor);
    updateGoalDecorations(editor);
    updateAgeDecorations(editor);
    updateSummaryDecorations(editor);
    updateChecklistProgressDecorations(editor);
}
