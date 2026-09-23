/**
 * commandRegistrationsD.ts
 * Phase 40+ commands - split from commandRegistrationsC.ts to stay under 200 lines.
 * Exported and spread into registerPhase12to32Commands() in commandRegistrationsC.ts.
 */
import * as vscode from 'vscode';
import { onOpenSettingsPanel }                            from './settingsPanel';
import { onTodayView }                                    from './todayViewCommands';
import { onShowKanban }                                   from './kanbanCommands';
import { onExportToObsidian }                             from './obsidianExportCommands';
import { onStartItemTimer, onStopItemTimer }              from './itemTimerCommands';
import { onStartFocusTimer, onStopFocusTimer }            from './focusTimerCommands';
import { onMarkAllDoneSection, onMarkAllUndoneSection }   from './bulkCheckboxCommands';
import { onSnapshotItem, onDiffItemWithSnapshot }         from './itemSnapshotCommands';
import { onSmartPaste }                                   from './smartPasteCommands';
import { onShowReadingTime }                              from './readingTimeCommands';
import { onShowTagStats }                                 from './tagStatsCommands';
import { onToggleDoneAllCursors, onSetPriorityAllCursors } from './multiCursorCommands';
import { onShowItemComplexity }                            from './itemComplexityCommands';
import { onFreezeSection, onUnfreezeSection }             from './sectionFreezeCommands';
import { onEvaluateExpression }                           from './expressionCommands';
import { onShowArchive }                                  from './archiveViewCommands';
import { onBatchReplaceText }                             from './batchReplaceCommands';
import { onShowMentionsReport }                           from './mentionsReportCommands';
import { onSortByDueDate }                                from './sortByDateCommands';
import { onCopySectionAsCsvRow }                          from './csvRowCommands';
import { onWrapItemText }                                 from './wrapItemCommands';
import { onQuickStats }                                   from './quickStatsCommands';
import { onInsertDateStamp }                              from './insertDateStampCommands';
import { onShowNestingBreakdown }                         from './nestingBreakdownCommands';
import { onRenameTagSection }                             from './renameTagSectionCommands';
import { onShowSectionTimeEstimate }                      from './sectionEstimateCommands';
import { onSendToDailyNote }                              from './sendToDailyNoteCommands';
import { onConvertItemToSectionLink }                     from './convertToLinkCommands';
import { onChangeItemPrefix }                             from './changePrefixCommands';
import { onShowSectionGrowth }                            from './sectionGrowthCommands';
import { onFilterByMultipleTags }                         from './multiTagFilterCommands';
import { onExtractUrlsFromSection }                       from './urlExtractorCommands';
import { onCloneSection }                                 from './cloneSectionCommands';
import { onCountWordFrequency }                           from './wordFrequencyCommands';
import { onShowSectionVoteLeaderboard }                   from './sectionVoteLeaderboardCommands';
import { onGroupItemsByMention }                          from './groupByMentionCommands';
import { onShowSectionPath }                              from './sectionPathCommands';
import { onShowWordCountGoals }                           from './wordCountGoalsCommands';
import { onBoldText, onItalicText, onUnderlineText, onMonoText, onStrikeText } from './richTextSimCommands';
import { onDuplicateSectionToFile }                      from './duplicateSectionToFileCommands';
import { onToggleFocusMode }                              from './dimDecoration';
import { onInsertGroupDivider }                           from './insertGroupDividerCommands';
import { onCopySectionAsHtml }                            from './sectionHtmlExportCommands';
import { onShowPrioritySummary }                          from './prioritySummaryCommands';
import { onShowItemAgeReport }                           from './itemAgeReportCommands';
import { onCopyItemAsMarkdown }                          from './copyItemAsMarkdownCommands';
import { onTextTransformPalette }                         from './textTransformPaletteCommands';

export function registerPhase40Commands(): vscode.Disposable[] {
    const r = vscode.commands.registerCommand;
    return [
        r('chevron-lists.todayView',                        onTodayView),
        r('chevron-lists.showKanban',                       onShowKanban),
        r('chevron-lists.exportToObsidian',                 onExportToObsidian),
        r('chevron-lists.startItemTimer',                   onStartItemTimer),
        r('chevron-lists.stopItemTimer',                    onStopItemTimer),
        r('chevron-lists.startFocusTimer',                  onStartFocusTimer),
        r('chevron-lists.stopFocusTimer',                   onStopFocusTimer),
        r('chevron-lists.markAllDoneSection',               onMarkAllDoneSection),
        r('chevron-lists.markAllUndoneSection',             onMarkAllUndoneSection),
        r('chevron-lists.snapshotItem',                     onSnapshotItem),
        r('chevron-lists.diffItemWithSnapshot',             onDiffItemWithSnapshot),
        r('chevron-lists.smartPaste',                       onSmartPaste),
        r('chevron-lists.showReadingTime',                  onShowReadingTime),
        r('chevron-lists.showTagStats',                     onShowTagStats),
        r('chevron-lists.toggleDoneAllCursors',             onToggleDoneAllCursors),
        r('chevron-lists.setPriorityAllCursors',            onSetPriorityAllCursors),
        r('chevron-lists.showItemComplexity',               onShowItemComplexity),
        r('chevron-lists.freezeSection',                    onFreezeSection),
        r('chevron-lists.unfreezeSection',                  onUnfreezeSection),
        r('chevron-lists.evaluateExpression',               onEvaluateExpression),
        r('chevron-lists.showArchive',                      onShowArchive),
        r('chevron-lists.batchReplaceText',                 onBatchReplaceText),
        r('chevron-lists.showMentionsReport',               onShowMentionsReport),
        r('chevron-lists.sortByDueDate',                    onSortByDueDate),
        r('chevron-lists.copySectionAsCsvRow',              onCopySectionAsCsvRow),
        r('chevron-lists.wrapItemText',                     onWrapItemText),
        r('chevron-lists.quickStats',                       onQuickStats),
        r('chevron-lists.insertDateStamp',                  onInsertDateStamp),
        r('chevron-lists.showNestingBreakdown',             onShowNestingBreakdown),
        r('chevron-lists.renameTagSection',                 onRenameTagSection),
        r('chevron-lists.showSectionTimeEstimate',          onShowSectionTimeEstimate),
        r('chevron-lists.sendToDailyNote',                  onSendToDailyNote),
        r('chevron-lists.convertItemToSectionLink',         onConvertItemToSectionLink),
        r('chevron-lists.changeItemPrefix',                 onChangeItemPrefix),
        r('chevron-lists.showSectionGrowth',                onShowSectionGrowth),
        r('chevron-lists.filterByMultipleTags',             onFilterByMultipleTags),
        r('chevron-lists.extractUrlsFromSection',           onExtractUrlsFromSection),
        r('chevron-lists.cloneSection',                     onCloneSection),
        r('chevron-lists.countWordFrequency',               onCountWordFrequency),
        r('chevron-lists.showSectionVoteLeaderboard',       onShowSectionVoteLeaderboard),
        r('chevron-lists.groupItemsByMention',              onGroupItemsByMention),
        r('chevron-lists.showSectionPath',                  onShowSectionPath),
        r('chevron-lists.showWordCountGoals',               onShowWordCountGoals),
        r('chevron-lists.boldText',                         onBoldText),
        r('chevron-lists.italicText',                       onItalicText),
        r('chevron-lists.underlineText',                    onUnderlineText),
        r('chevron-lists.monoText',                         onMonoText),
        r('chevron-lists.strikeText',                       onStrikeText),
        r('chevron-lists.textTransformPalette',             onTextTransformPalette),
        r('chevron-lists.duplicateSectionToFile',           onDuplicateSectionToFile),
        r('chevron-lists.toggleFocusMode',                  onToggleFocusMode),
        r('chevron-lists.insertGroupDivider',               onInsertGroupDivider),
        r('chevron-lists.copySectionAsHtml',                onCopySectionAsHtml),
        r('chevron-lists.showPrioritySummary',              onShowPrioritySummary),
        r('chevron-lists.showItemAgeReport',                onShowItemAgeReport),
        r('chevron-lists.copyItemAsMarkdown',               onCopyItemAsMarkdown),
        r('chevron-lists.openSettings',                     onOpenSettingsPanel),
    ];
}
