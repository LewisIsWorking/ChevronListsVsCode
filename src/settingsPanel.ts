/**
 * settingsPanel.ts
 * VS Code webview panel for Chevron Lists settings + command launcher.
 * Pure HTML/logic lives in settingsPanelHtml.ts and settingsPanelCommands.ts.
 */
import * as vscode from 'vscode';
import { getConfig }            from './config';
import { buildSettingsPanelHtml } from './settingsPanelHtml';
import { buildCommandGroups }   from './settingsPanelCommands';

let panel: vscode.WebviewPanel | undefined;

/** Allowlist of webview data-keys → chevron-lists config keys (suffix only) */
const ALLOWED_KEYS = new Set([
    'listPrefix', 'defaultNewListType', 'blankLineAfterHeader',
    'autoFixNumbering', 'autoArchive', 'snippetTrigger',
    'colourPreset', 'dailyNotesFolder', 'dailyNoteTemplate',
]);

type PanelMessage =
    | { type: 'updateSetting'; key: string; value: string | boolean }
    | { type: 'runCommand';    command: string }
    | { type: 'openSettings' };

async function handleMessage(msg: PanelMessage): Promise<void> {
    if (msg.type === 'updateSetting' && ALLOWED_KEYS.has(msg.key)) {
        const cfg = vscode.workspace.getConfiguration('chevron-lists');
        await cfg.update(msg.key, msg.value, vscode.ConfigurationTarget.Global);
        // Re-apply colour preset immediately if that setting changed
        if (msg.key === 'colourPreset') {
            await vscode.commands.executeCommand('chevron-lists.switchColourPreset');
        }
    } else if (msg.type === 'runCommand' && typeof msg.command === 'string' && msg.command.startsWith('chevron-lists.')) {
        // Only this extension's own commands: the panel never needs any other
        await vscode.commands.executeCommand(msg.command);
    } else if (msg.type === 'openSettings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:lewisisworking.chevron-lists');
    }
}

/** Opens (or reveals) the Chevron Lists settings panel */
export function onOpenSettingsPanel(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.One); return; }

    panel = vscode.window.createWebviewPanel(
        'chevron-lists.settings',
        '⚡ Chevron Lists',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.onDidDispose(() => { panel = undefined; });
    panel.webview.onDidReceiveMessage((msg: PanelMessage) => { void handleMessage(msg); });
    panel.webview.html = buildSettingsPanelHtml(getConfig(), buildCommandGroups());
}

/** Opens the panel on first install; no-op if already shown before */
export function openOnFirstInstall(context: vscode.ExtensionContext): void {
    const key = 'chevron-lists.welcomeShown';
    if (!context.globalState.get<boolean>(key)) {
        void context.globalState.update(key, true);
        onOpenSettingsPanel();
    }
}
