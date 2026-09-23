import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';

interface TimerEntry { startMs: number; headerLine: number; sectionName: string; }

let activeTimer: TimerEntry | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

const TIMER_DECORATION = vscode.window.createTextEditorDecorationType({
    after: { margin: '0 0 0 1em', color: new vscode.ThemeColor('editorLineNumber.foreground') },
});

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const mins     = Math.floor(totalSec / 60);
    const secs     = totalSec % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDecoration(): void {
    if (!activeTimer) { return; }
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const elapsed = Date.now() - activeTimer.startMs;
    const label   = `  ⏱ ${formatElapsed(elapsed)}`;
    const doc     = editor.document;
    if (activeTimer.headerLine >= doc.lineCount) { return; }
    editor.setDecorations(TIMER_DECORATION, [{
        range: doc.lineAt(activeTimer.headerLine).range,
        renderOptions: { after: { contentText: label } },
    }]);
    if (statusBarItem) { statusBarItem.text = `$(clock) ${activeTimer.sectionName}: ${formatElapsed(elapsed)}`; }
}

/** Command: starts a timer on the current section */
export async function onStartSectionTimer(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    if (activeTimer) {
        vscode.window.showInformationMessage(`CL: Timer already running for "${activeTimer.sectionName}" - stop it first`);
        return;
    }
    const headerLine = findHeaderAbove(editor.document, editor.selection.active.line);
    if (headerLine < 0) { vscode.window.showInformationMessage('CL: No section found at cursor'); return; }
    const sectionName = editor.document.lineAt(headerLine).text.replace(/^> /, '');

    activeTimer = { startMs: Date.now(), headerLine, sectionName };
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
        statusBarItem.command = 'chevron-lists.stopSectionTimer';
        statusBarItem.tooltip = 'Click to stop timer';
    }
    statusBarItem.show();
    intervalHandle = setInterval(updateTimerDecoration, 1000);
    updateTimerDecoration();
    vscode.window.showInformationMessage(`CL: Timer started for "${sectionName}"`);
}

/** Command: stops the active section timer */
export async function onStopSectionTimer(): Promise<void> {
    if (!activeTimer) { vscode.window.showInformationMessage('CL: No timer is running'); return; }
    const elapsed     = Date.now() - activeTimer.startMs;
    const sectionName = activeTimer.sectionName;
    if (intervalHandle)  { clearInterval(intervalHandle); intervalHandle = null; }
    if (statusBarItem)   { statusBarItem.dispose(); statusBarItem = null; }
    activeTimer = null;
    const editor = vscode.window.activeTextEditor;
    if (editor) { editor.setDecorations(TIMER_DECORATION, []); }
    vscode.window.showInformationMessage(`CL: Timer stopped - "${sectionName}" ran for ${formatElapsed(elapsed)}`);
}
