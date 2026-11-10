import * as vscode from 'vscode';
import { findHeaderAbove } from './documentUtils';
import { findTrackedLine, linesOf, TrackedLine } from './timerTracking';

interface TimerEntry { startMs: number; header: TrackedLine; uri: string; sectionName: string; }

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

/** The open editor showing the timed file, whichever editor is active */
function timerEditor(uri: string): vscode.TextEditor | undefined {
    return vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri);
}

function updateTimerDecoration(): void {
    if (!activeTimer) { return; }
    const elapsed = Date.now() - activeTimer.startMs;
    if (statusBarItem) { statusBarItem.text = `$(clock) ${activeTimer.sectionName}: ${formatElapsed(elapsed)}`; }
    const editor = timerEditor(activeTimer.uri);
    if (!editor) { return; }
    const doc   = editor.document;
    const lines = linesOf(doc);
    const line  = findTrackedLine(lines, activeTimer.header);
    if (line < 0 || line >= doc.lineCount) { editor.setDecorations(TIMER_DECORATION, []); return; }
    activeTimer.header = { index: line, text: lines[line], lineCount: lines.length };
    editor.setDecorations(TIMER_DECORATION, [{
        range: doc.lineAt(line).range,
        renderOptions: { after: { contentText: `  ⏱ ${formatElapsed(elapsed)}` } },
    }]);
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

    const header = { index: headerLine, text: editor.document.lineAt(headerLine).text, lineCount: editor.document.lineCount };
    activeTimer = { startMs: Date.now(), header, uri: editor.document.uri.toString(), sectionName };
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
    const editor      = timerEditor(activeTimer.uri);
    if (intervalHandle)  { clearInterval(intervalHandle); intervalHandle = null; }
    if (statusBarItem)   { statusBarItem.dispose(); statusBarItem = null; }
    activeTimer = null;
    if (editor) { editor.setDecorations(TIMER_DECORATION, []); }
    vscode.window.showInformationMessage(`CL: Timer stopped - "${sectionName}" ran for ${formatElapsed(elapsed)}`);
}
