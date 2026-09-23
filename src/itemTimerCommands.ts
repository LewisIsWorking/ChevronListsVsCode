import * as vscode from 'vscode';
import { getConfig } from './config';
import { parseBullet, parseNumbered, formatElapsed } from './patterns';

interface ActiveTimer { startMs: number; lineIndex: number; uri: string; statusBar: vscode.StatusBarItem; interval: ReturnType<typeof setInterval>; }

let activeTimer: ActiveTimer | undefined;

/** Command: starts a timer on the item at the cursor */
export async function onStartItemTimer(): Promise<void> {
    if (activeTimer) {
        vscode.window.showWarningMessage('CL: A timer is already running - stop it first with CL: Stop Item Timer');
        return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') { return; }
    const { prefix }  = getConfig();
    const lineIndex   = editor.selection.active.line;
    const text        = editor.document.lineAt(lineIndex).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage('CL: Place cursor on a chevron item to start a timer');
        return;
    }
    const content = bullet?.content ?? numbered!.content;
    const label   = content.slice(0, 30) + (content.length > 30 ? '…' : '');
    const bar     = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -100);
    bar.tooltip   = `CL: Item timer - click to stop`;
    bar.command   = 'chevron-lists.stopItemTimer';
    bar.show();

    activeTimer = { startMs: Date.now(), lineIndex, uri: editor.document.uri.toString(), statusBar: bar, interval: setInterval(() => {
        const elapsed = formatElapsed(Date.now() - activeTimer!.startMs);
        bar.text = `$(clock) ${elapsed}  "${label}"`;
    }, 1000) };
    bar.text = `$(clock) 0s  "${label}"`;
    vscode.window.showInformationMessage(`CL: Timer started - click the status bar to stop`);
}

/** Command: stops the running timer and stamps the item with ~elapsed */
export async function onStopItemTimer(): Promise<void> {
    if (!activeTimer) {
        vscode.window.showInformationMessage('CL: No timer is running');
        return;
    }
    const elapsed = formatElapsed(Date.now() - activeTimer.startMs);
    clearInterval(activeTimer.interval);
    activeTimer.statusBar.dispose();
    const timer = activeTimer;
    activeTimer = undefined;

    const { prefix } = getConfig();
    const uris        = vscode.workspace.textDocuments.filter(d => d.uri.toString() === timer.uri);
    const doc         = uris[0] ?? await vscode.workspace.openTextDocument(vscode.Uri.parse(timer.uri));
    const text        = doc.lineAt(timer.lineIndex).text;
    const bullet      = parseBullet(text, prefix);
    const numbered    = parseNumbered(text);
    if (!bullet && !numbered) {
        vscode.window.showInformationMessage(`CL: Timer stopped - ${elapsed} elapsed`);
        return;
    }
    const chevrons   = bullet?.chevrons ?? numbered!.chevrons;
    const content    = bullet?.content  ?? numbered!.content;
    const num        = numbered?.num ?? null;
    // Replace existing ~estimate or append new one
    const newContent = content.replace(/\s*~\w+/, '').trim() + ` ~${elapsed}`;
    const newLine    = num !== null ? `${chevrons} ${num}. ${newContent}` : `${chevrons} ${prefix} ${newContent}`;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, doc.lineAt(timer.lineIndex).range, newLine);
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage(`CL: Timer stopped - ${elapsed} stamped on item`);
}
