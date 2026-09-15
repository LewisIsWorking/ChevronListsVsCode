/**
 * commandRegistrationsC.ts
 * Phase 12-39 commands. Phase 40+ live in commandRegistrationsD.ts.
 */
import * as vscode from 'vscode';
import { onEditItemContent }                              from './editItemCommands';
import { onCollectItemsByTag }                            from './collectByTagCommands';
import { onConvertSectionToTable }                        from './tableExportCommands';
import { onMoveItemToSection }                            from './moveItemToSectionCommands';
import { onDiffTwoSections }                              from './diffSectionCommands';
import { onClearAllPriority, onClearAllDueDates }        from './batchClearCommands';
import { onToggleItemCountBadge }                         from './itemCountBadge';
import { onPasteAsSection }                               from './pasteSectionCommands';
import { onFoldAllSections, onUnfoldAllSections }        from './foldAllCommands';
import { onRemoveOldItems }                               from './removeOldItemsCommands';
import { onShowJumpHistory }                              from './jumpHistory';
import { onDuplicateItemAndIncrement }                    from './duplicateIncrementCommands';
import { onNewSection }                                   from './newSectionCommands';
import { onSectionHealthCheck }                           from './healthCheckCommands';
import { onInsertItemSnippet }                            from './itemSnippetCommands';
import { onInsertFileSectionLink }                        from './fileSectionLinkCommands';
import { onShowTagReportWorkspace }                       from './tagReportCommands';
import { onFilterByColourLabel }                          from './colourFilterCommands';
import { onPinSectionToTop }                              from './pinToTopCommands';
import { onSetItemRating, onFilterByRating }              from './ratingCommands';
import { onStartSectionTimer, onStopSectionTimer }        from './sectionTimer';
import { onShowSectionWeights }                           from './sectionWeightCommands';
import { onShiftAllDueDates }                             from './shiftDueDatesCommands';
import { onShowCompletionStreak }                         from './completionStreakCommands';
import { onCopySectionAsJson }                            from './jsonCopyCommands';
import { onMoveItemToFile }                               from './moveItemToFileCommands';
import { onOpenDailyNote }                                from './dailyNoteCommands';
import { onCopySectionAs }                                from './copySectionAsCommands';
import { onBulkSetRating }                                from './bulkRatingCommands';
import { onExportAllSectionsAsJson }                      from './exportAllJsonCommands';
import { onRewriteItem }                                  from './rewriteItemCommands';
import { onToggleSummaryDecoration,
         onToggleChecklistBar,
         onToggleWordGoalBar,
         onToggleAgeHighlight,
         onToggleAllDecorations }                         from './decorationToggles';
import { onFilterByColourLabelWorkspace }                 from './colourFilterWorkspaceCommands';
import { onShowExpiredItems }                             from './expiryCommands';
import { onBrowseTemplates }                              from './templateGallery';
import { onCopyItemAsRichText }                           from './richTextCommands';
import { onShowDependencyGraph }                          from './dependencyGraphCommands';
import { onSetExpiryOnAllItems }                          from './bulkExpiryCommands';
import { onGroupItemsByTag }                              from './groupByTagCommands';
import { onShowProgressReport }                           from './progressReportCommands';
import { onMergeItemWithNext }                            from './mergeItemCommands';
import { onSplitItemAtCursor }                            from './splitItemCommands';
import { onCloneItemAsDone, onCloneItemStripped }         from './cloneTransformCommands';
import { onShowRecentSections }                           from './recentSectionsCommands';
import { onShowDuplicateItems }                           from './duplicateItemsCommands';
import { onShowWordCloud }                                from './wordCloudCommands';
import { onSetDueDate }                                   from './setDueDateCommands';
import { onFindSimilarSections }                          from './similarSectionsCommands';
import { onShowVoteLeaderboard }                          from './voteLeaderboardCommands';
import { onShowAgeStats }                                 from './ageStatsCommands';
import { onSetSectionColour }                             from './sectionColourCommands';
import { onStampAllItems }                                from './stampAllCommands';
import { onCompareTwoSectionsAsTable }                    from './sectionCompareTableCommands';
import { onInsertRecurringItem }                          from './recurringTemplateCommands';
import { onRenameSectionWorkspace }                       from './renameSectionWorkspaceCommands';
import { onSortByPriority }                               from './sortByPriorityCommands';
import { onArchiveOldDoneItems }                          from './archiveOldDoneCommands';
import { onFindDeadLinks }                                from './deadLinksCommands';
import { onAddQuickNote }                                 from './quickNoteCommands';
import { ChevronTagCompletionProvider,
         ChevronMentionCompletionProvider,
         ChevronLinkCompletionProvider,
         ChevronPriorityCompletionProvider,
         ChevronDateCompletionProvider }                  from './completionProviders';
import { ChevronEstimateCompletionProvider,
         ChevronRatingCompletionProvider,
         ChevronHeaderCompletionProvider }                from './completionProvidersExtra';
import { registerPhase40Commands }                        from './commandRegistrationsD';
import { registerPasteItemsProvider }                     from './pasteItemsProvider';

const MARKDOWN = { language: 'markdown' };
const comp     = vscode.languages.registerCompletionItemProvider;

export function registerPhase12to32Commands(): vscode.Disposable[] {
    const r = vscode.commands.registerCommand;
    return [
        r('chevron-lists.editItemContent',                  onEditItemContent),
        r('chevron-lists.collectItemsByTag',                onCollectItemsByTag),
        r('chevron-lists.convertSectionToTable',            onConvertSectionToTable),
        r('chevron-lists.moveItemToSection',                onMoveItemToSection),
        r('chevron-lists.diffTwoSections',                  onDiffTwoSections),
        r('chevron-lists.clearAllPriority',                 onClearAllPriority),
        r('chevron-lists.clearAllDueDates',                 onClearAllDueDates),
        r('chevron-lists.toggleItemCountBadge',             onToggleItemCountBadge),
        r('chevron-lists.pasteAsSection',                   onPasteAsSection),
        r('chevron-lists.foldAllSections',                  onFoldAllSections),
        r('chevron-lists.unfoldAllSections',                onUnfoldAllSections),
        r('chevron-lists.removeOldItems',                   onRemoveOldItems),
        r('chevron-lists.showJumpHistory',                  onShowJumpHistory),
        r('chevron-lists.duplicateItemAndIncrement',        onDuplicateItemAndIncrement),
        r('chevron-lists.newSection',                       onNewSection),
        r('chevron-lists.sectionHealthCheck',               onSectionHealthCheck),
        r('chevron-lists.insertItemSnippet',                onInsertItemSnippet),
        r('chevron-lists.insertFileSectionLink',            onInsertFileSectionLink),
        r('chevron-lists.showTagReportWorkspace',           onShowTagReportWorkspace),
        r('chevron-lists.filterByColourLabel',              onFilterByColourLabel),
        r('chevron-lists.pinSectionToTop',                  onPinSectionToTop),
        r('chevron-lists.setItemRating',                    onSetItemRating),
        r('chevron-lists.filterByRating',                   onFilterByRating),
        r('chevron-lists.startSectionTimer',                onStartSectionTimer),
        r('chevron-lists.stopSectionTimer',                 onStopSectionTimer),
        r('chevron-lists.showSectionWeights',               onShowSectionWeights),
        r('chevron-lists.shiftAllDueDates',                 onShiftAllDueDates),
        r('chevron-lists.showCompletionStreak',             onShowCompletionStreak),
        r('chevron-lists.copySectionAsJson',                onCopySectionAsJson),
        r('chevron-lists.moveItemToFile',                   onMoveItemToFile),
        r('chevron-lists.openDailyNote',                    onOpenDailyNote),
        r('chevron-lists.copySectionAs',                    onCopySectionAs),
        r('chevron-lists.bulkSetRating',                    onBulkSetRating),
        r('chevron-lists.exportAllSectionsAsJson',          onExportAllSectionsAsJson),
        r('chevron-lists.rewriteItem',                      onRewriteItem),
        r('chevron-lists.toggleSummaryDecoration',          onToggleSummaryDecoration),
        r('chevron-lists.toggleChecklistBar',               onToggleChecklistBar),
        r('chevron-lists.toggleWordGoalBar',                onToggleWordGoalBar),
        r('chevron-lists.toggleAgeHighlight',               onToggleAgeHighlight),
        r('chevron-lists.toggleAllDecorations',             onToggleAllDecorations),
        r('chevron-lists.filterByColourLabelWorkspace',     onFilterByColourLabelWorkspace),
        r('chevron-lists.showExpiredItems',                 onShowExpiredItems),
        r('chevron-lists.browseTemplates',                  onBrowseTemplates),
        r('chevron-lists.copyItemAsRichText',               onCopyItemAsRichText),
        r('chevron-lists.showDependencyGraph',              onShowDependencyGraph),
        r('chevron-lists.setExpiryOnAllItems',              onSetExpiryOnAllItems),
        r('chevron-lists.groupItemsByTag',                  onGroupItemsByTag),
        r('chevron-lists.showProgressReport',               onShowProgressReport),
        r('chevron-lists.mergeItemWithNext',                onMergeItemWithNext),
        r('chevron-lists.splitItemAtCursor',                onSplitItemAtCursor),
        r('chevron-lists.cloneItemAsDone',                  onCloneItemAsDone),
        r('chevron-lists.cloneItemStripped',                onCloneItemStripped),
        r('chevron-lists.showRecentSections',               onShowRecentSections),
        r('chevron-lists.showDuplicateItems',               onShowDuplicateItems),
        r('chevron-lists.showWordCloud',                    onShowWordCloud),
        r('chevron-lists.setDueDate',                       onSetDueDate),
        r('chevron-lists.findSimilarSections',              onFindSimilarSections),
        r('chevron-lists.showVoteLeaderboard',              onShowVoteLeaderboard),
        r('chevron-lists.showAgeStats',                     onShowAgeStats),
        r('chevron-lists.setSectionColour',                 onSetSectionColour),
        r('chevron-lists.stampAllItems',                    onStampAllItems),
        r('chevron-lists.compareTwoSectionsAsTable',        onCompareTwoSectionsAsTable),
        r('chevron-lists.insertRecurringItem',              onInsertRecurringItem),
        r('chevron-lists.renameSectionWorkspace',           onRenameSectionWorkspace),
        r('chevron-lists.sortByPriority',                   onSortByPriority),
        r('chevron-lists.archiveOldDoneItems',              onArchiveOldDoneItems),
        r('chevron-lists.findDeadLinks',                    onFindDeadLinks),
        r('chevron-lists.addQuickNote',                     onAddQuickNote),
        ...registerPhase40Commands(),
        comp(MARKDOWN, new ChevronTagCompletionProvider(),      '#'),
        comp(MARKDOWN, new ChevronMentionCompletionProvider(),  '@'),
        comp(MARKDOWN, new ChevronLinkCompletionProvider(),     '['),
        comp(MARKDOWN, new ChevronPriorityCompletionProvider(), '!'),
        comp(MARKDOWN, new ChevronDateCompletionProvider(),     '@'),
        comp(MARKDOWN, new ChevronEstimateCompletionProvider(), '~'),
        comp(MARKDOWN, new ChevronRatingCompletionProvider(),   '★'),
        comp(MARKDOWN, new ChevronHeaderCompletionProvider(),   '>'),
        ...registerPasteItemsProvider(),
    ];
}
