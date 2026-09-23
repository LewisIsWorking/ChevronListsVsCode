/**
 * settingsPanelHtml.ts
 * Pure functions that build the HTML for the Chevron Lists settings webview panel.
 * No VS Code imports - fully testable.
 */
import type { ChevronConfig }  from './types';
import type { CommandGroup }   from './settingsPanelCommands';

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toggle(key: string, label: string, desc: string, checked: boolean): string {
    return `<div class="row"><label class="tgl"><input type="checkbox" data-key="${key}"${checked ? ' checked' : ''}><span class="tgl-box"></span><div><strong>${label}</strong><p class="desc">${desc}</p></div></label></div>`;
}

function sel(key: string, label: string, desc: string, value: string, opts: Array<[string, string]>): string {
    const o = opts.map(([v, t]) => `<option value="${v}"${value === v ? ' selected' : ''}>${t}</option>`).join('');
    return `<div class="row"><strong>${label}</strong><p class="desc">${desc}</p><select data-key="${key}">${o}</select></div>`;
}

function txt(key: string, label: string, desc: string, value: string, type = 'text'): string {
    return `<div class="row"><strong>${label}</strong><p class="desc">${desc}</p><input type="${type}" data-key="${key}" value="${esc(value)}"></div>`;
}

/** Pure: builds the Commands tab HTML from the provided groups */
export function buildCommandGroupsHtml(groups: CommandGroup[]): string {
    return groups.map(g =>
        `<div class="group"><h3>${esc(g.group)}</h3><div class="cmds">${
            g.commands.map(cmd => `<button class="cmd-btn" onclick="run('${cmd.id}')">${esc(cmd.label)}</button>`).join('')
        }</div></div>`
    ).join('');
}

/** Pure: builds the complete webview HTML document for the settings panel */
export function buildSettingsPanelHtml(cfg: ChevronConfig, groups: CommandGroup[]): string {
    const COLOURS:  Array<[string,string]> = [['default','Default'],['ocean','Ocean'],['forest','Forest'],['sunset','Sunset'],['monochrome','Monochrome'],['midnight','Midnight'],['rose','Rose'],['autumn','Autumn'],['arctic','Arctic'],['neon','Neon'],['sepia','Sepia'],['custom','Custom']];
    const SNIPPETS: Array<[string,string]> = [['tab','Tab'],['ctrl+enter','Ctrl+Enter'],['none','None']];
    const LISTS:    Array<[string,string]> = [['unordered','Bullet (>> -)'],['ordered','Numbered (>> 1.)']];

    const settings = [
        '<section><h2>List Behaviour</h2>',
        txt('listPrefix', 'List Prefix', "Character used after >> for bullet items. Default: '-'", cfg.prefix),
        sel('defaultNewListType', 'Default New List Type', 'List type inserted when pressing Enter on a header line.', cfg.defaultNewListType, LISTS),
        toggle('blankLineAfterHeader', 'Blank Line After Header', 'Insert a blank line between a header and its first item when pressing Enter.', cfg.blankLine),
        toggle('autoFixNumbering', 'Auto Fix Numbering', 'Automatically fix duplicate or out-of-sequence numbered items as you type.', cfg.autoFixNumbering),
        '</section><section><h2>Behaviour</h2>',
        toggle('autoArchive', 'Auto Archive', 'Toggling an item [x] done automatically moves it to the > Archive section.', cfg.autoArchive),
        sel('snippetTrigger', 'Snippet Trigger', 'Key that expands chl / chn snippets.', cfg.snippetTrigger, SNIPPETS),
        '</section><section><h2>Appearance</h2>',
        sel('colourPreset', 'Colour Preset', 'Built-in colour preset for chevron syntax highlighting.', cfg.colourPreset, COLOURS),
        '</section><section><h2>Daily Notes</h2>',
        txt('dailyNotesFolder', 'Daily Notes Folder', 'Folder for daily notes. Relative to workspace root, or absolute path.', cfg.dailyNotesFolder),
        txt('dailyNoteTemplate', 'Daily Note Template', 'Template text for new notes. Supports {{date}}, {{weekday}}, {{day}}.', cfg.dailyNoteTemplate),
        '</section><section><h2>AI Assist</h2>',
        txt('anthropicApiKey', 'Anthropic API Key', 'Required for CL: Suggest Items, Summarise Section, Expand Item, and Rewrite Item. Get one at https://console.anthropic.com', cfg.anthropicApiKey, 'password'),
        '</section><section><h2>Templates</h2>',
        '<div class="row"><strong>User Templates</strong><p class="desc">Templates are structured objects - best edited directly in settings.json.</p>' +
        '<button class="cmd-btn" onclick="post({type:\'openSettings\'})">Edit in settings.json ↗</button></div></section>',
    ].join('');

    const css = `*{box-sizing:border-box}body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:0;margin:0}.header{padding:1rem 1.5rem 0;border-bottom:1px solid var(--vscode-panel-border)}.welcome{padding:.6rem 1rem;background:var(--vscode-editor-inactiveSelectionBackground);font-size:.82rem;border-bottom:1px solid var(--vscode-panel-border)}.tabs{display:flex;margin-bottom:-1px}.tab{padding:.5rem 1.2rem;cursor:pointer;border:1px solid transparent;border-bottom:none;background:none;color:var(--vscode-foreground);opacity:.55;font-size:.88rem}.tab.active{background:var(--vscode-editor-background);border-color:var(--vscode-panel-border);opacity:1;border-bottom-color:var(--vscode-editor-background)}.content{padding:1.5rem;max-width:680px}section{margin-bottom:1.5rem}h1{font-size:1.2rem;margin:0 0 .5rem;color:var(--vscode-textLink-foreground)}h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin:0 0 .7rem}.row{margin-bottom:1rem}.row strong{display:block;margin-bottom:.2rem;font-size:.88rem}.desc{margin:0 0 .35rem;font-size:.76rem;opacity:.6}input[type=text],input[type=password],select{width:100%;padding:.3rem .5rem;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:3px;font:inherit;font-size:.84rem}.tgl{display:flex;gap:.7rem;align-items:flex-start;cursor:pointer}.tgl input{display:none}.tgl-box{min-width:36px;height:20px;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,#555);border-radius:10px;position:relative;margin-top:2px;transition:background .15s}.tgl input:checked+.tgl-box{background:var(--vscode-textLink-foreground)}.tgl-box::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}.tgl input:checked+.tgl-box::after{transform:translateX(16px)}.cmd-btn{margin:.2rem;padding:.25rem .6rem;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;cursor:pointer;font-size:.78rem}.cmd-btn:hover{opacity:.85}.group{margin-bottom:1.1rem}.group h3{font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;opacity:.5;margin:0 0 .35rem}.cmds{display:flex;flex-wrap:wrap;gap:.2rem}#tab-commands{display:none}`;

    const js = `const vscode=acquireVsCodeApi();function post(m){vscode.postMessage(m);}function run(cmd){post({type:'runCommand',command:cmd});}function switchTab(id,btn){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');document.getElementById('tab-settings').style.display=id==='settings'?'block':'none';document.getElementById('tab-commands').style.display=id==='commands'?'block':'none';}document.querySelectorAll('input[type=checkbox][data-key]').forEach(el=>el.addEventListener('change',()=>post({type:'updateSetting',key:el.dataset.key,value:el.checked})));document.querySelectorAll('select[data-key],input[type=text][data-key],input[type=password][data-key]').forEach(el=>el.addEventListener('change',()=>post({type:'updateSetting',key:el.dataset.key,value:el.value})));`;

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Chevron Lists</title><style>${css}</style></head><body>
<div class="header"><h1>⚡ Chevron Lists</h1>
<div class="welcome">✨ <strong>Welcome!</strong> A powerful markdown list manager with 300+ commands. All settings update instantly - no restart needed. Use the <strong>Commands</strong> tab to run any CL command by clicking, or keep using the command palette - both work.</div>
<div class="tabs"><button class="tab active" onclick="switchTab('settings',this)">⚙️ Settings</button><button class="tab" onclick="switchTab('commands',this)">📋 Commands</button></div></div>
<div id="tab-settings" class="content">${settings}</div>
<div id="tab-commands" class="content">${buildCommandGroupsHtml(groups)}</div>
<script>${js}</script></body></html>`;
}
