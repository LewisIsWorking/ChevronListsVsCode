import * as vscode from 'vscode';

let focusTimer: { end: number; bar: vscode.StatusBarItem; interval: ReturnType<typeof setInterval> } | undefined;

/** Command: starts a configurable countdown focus timer */
export async function onStartFocusTimer(): Promise<void> {
    if (focusTimer) {
        vscode.window.showWarningMessage('CL: Focus timer already running - stop it first');
        return;
    }
    const cfg     = vscode.workspace.getConfiguration('chevron-lists');
    const minutes = cfg.get<number>('focusTimerMinutes', 25);
    const ms      = minutes * 60 * 1000;
    const end     = Date.now() + ms;
    const bar     = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -99);
    bar.tooltip   = `CL: Focus timer - click to stop`;
    bar.command   = 'chevron-lists.stopFocusTimer';
    bar.show();

    const tick = () => {
        const remaining = Math.max(0, end - Date.now());
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        bar.text = `$(watch) ${m}:${s.toString().padStart(2, '0')}`;
        if (remaining === 0) { void onStopFocusTimer(true); }
    };
    tick();
    focusTimer = { end, bar, interval: setInterval(tick, 1000) };
    vscode.window.showInformationMessage(`CL: Focus timer started - ${minutes} minutes`);
}

/** Command: stops the focus timer */
export async function onStopFocusTimer(completed = false): Promise<void> {
    if (!focusTimer) {
        vscode.window.showInformationMessage('CL: No focus timer running');
        return;
    }
    clearInterval(focusTimer.interval);
    focusTimer.bar.dispose();
    focusTimer = undefined;
    if (completed) {
        vscode.window.showInformationMessage('CL: Focus timer complete! 🎉 Time for a break.');
    } else {
        vscode.window.showInformationMessage('CL: Focus timer stopped');
    }
}
