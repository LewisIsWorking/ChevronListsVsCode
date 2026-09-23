import * as vscode from 'vscode';
import { TIPS } from './tips';

const STATE_KEY    = 'chevron-lists.tipIndex';
const DISMISS_KEY  = 'chevron-lists.tipsDisabled';

/** Shows a rotating tip of the day on activation unless the user dismissed them */
export function showTipOfDay(context: vscode.ExtensionContext): void {
    if (context.globalState.get<boolean>(DISMISS_KEY, false)) { return; }

    const index = context.globalState.get<number>(STATE_KEY, 0) % TIPS.length;
    const tip   = TIPS[index];
    void context.globalState.update(STATE_KEY, index + 1);

    // Build message - append keybinding hint if present
    const keybindingHint = tip.keybinding ? `  [${tip.keybinding}]` : '';
    const message = `💡 Chevron Lists tip: **${tip.title}** - ${tip.body}${keybindingHint}`;

    const actions: string[] = ['Next Tip', 'Stop Showing Tips'];
    if (tip.command) { actions.unshift('Try It'); }

    vscode.window.showInformationMessage(message, ...actions).then(choice => {
        if (choice === 'Try It' && tip.command) {
            vscode.commands.executeCommand(tip.command);
        } else if (choice === 'Next Tip') {
            const next    = (index + 1) % TIPS.length;
            const nextTip = TIPS[next];
            void context.globalState.update(STATE_KEY, next + 1);
            const nextKeybinding = nextTip.keybinding ? `  [${nextTip.keybinding}]` : '';
            vscode.window.showInformationMessage(
                `💡 **${nextTip.title}** - ${nextTip.body}${nextKeybinding}`
            );
        } else if (choice === 'Stop Showing Tips') {
            void context.globalState.update(DISMISS_KEY, true);
            vscode.window.showInformationMessage(
                'Chevron Lists tips disabled. Re-enable with `CL: Show Tip of the Day`.'
            );
        }
    });
}

/** Command: shows a tip on demand and re-enables if disabled */
export async function onShowTipOfDay(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(DISMISS_KEY, false);
    showTipOfDay(context);
}
