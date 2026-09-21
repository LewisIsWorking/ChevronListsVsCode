/**
 * commandRegistrationsB.ts
 * Search, filter, item-actions, bulk, clone, merge, archive, export, providers.
 */
import * as vscode from 'vscode';
import { onSearchItems, onFilterSections }                   from './searchCommands';
import { onSearchItemsWorkspace,
         onFilterSectionsWorkspace }                         from './workspaceSearch';
import { onFilterByTag }                                     from './tagCommands';
import { onFilterByTagWorkspace }                            from './tagWorkspaceCommands';
import { onFilterByPriority }                                from './priorityCommands';
import { onFilterByMention }                                 from './mentionCommands';
import { onTogglePin, onFilterPinnedSections }               from './pinCommands';
import { onFilterGroups, onGroupSections }                   from './groupCommands';
import { onToggleItemDone }                                  from './checkCommands';
import { onToggleNote }                                      from './noteCommands';
import { ChevronLinkHoverProvider, ChevronLinkDefinitionProvider,
         ChevronDocumentLinkProvider, onGoToLinkedSection }  from './linkProvider';
import { onExportAsHtml }                                    from './htmlExportCommands';
import { onShowUpcoming }                                    from './dueDateCommands';
import { onSuggestItems, onSummariseSection, onExpandItem }  from './aiCommands';
import { onQuickCapture }                                    from './quickCapture';
import { onSaveSectionAsTemplate }                           from './saveTemplate';
import { onExportAsJson, onExportAsCsv }                    from './structuredExportCommands';
import { onShowRecurring, onGenerateNextOccurrence }         from './recurrenceCommands';
import { onSetWordCountGoal }                                from './wordGoalCommands';
import { onBulkTagItems, onBulkSetPriority,
         onBulkSetDueDate }                                  from './bulkCommands';
import { onCloneItem, onCloneItemToSection }                 from './cloneCommands';
import { onMergeSectionBelow, onSplitSectionHere }           from './mergeSplitCommands';
import { onEnterReadingMode }                                from './readingMode';
import { onCompareSectionToClipboard }                       from './compareCommands';
import { onArchiveDoneItems, onArchiveSection }              from './archiveCommands';
import { onFindInSections, onReplaceInSection }              from './findReplaceCommands';
import { onFocusSection, onUnfocusSection }                  from './focusMode';
import { onAddBookmark, onJumpToBookmark,
         onRemoveBookmark }                                  from './bookmarkCommands';
import { onShowSectionSummary, onCountItemsByTag }          from './counterCommands';
import { onJumpBack }                                         from './jumpHistory';
import { onPromoteItemToHeader, onDemoteHeaderToItem }      from './promoteDemote';
import { onExportAsMarkdownDoc }                            from './markdownExportCommands';
import { onToggleStar, onFilterStarredItems }               from './starCommands';
import { onExportStatsAsCsv, onExportStatsAsJson }          from './statsExportCommands';
import { onGoToLinkedFile,
         ChevronFileLinkHoverProvider }                     from './fileLinkCommands';
import { onShowTimeEstimates }                              from './estimateCommands';
import { onShowDependencies }                               from './dependencyCommands';
import { onSortByVotes, onAddVote, onRemoveVote }           from './voteCommands';
import { onHideSection, onShowHiddenSections }              from './visibilityCommands';
import { onSwitchColourPreset }                             from './presetCommands';
import { onShowStatistics }                                  from './statisticsPanel';
import { onInsertTemplate }                                  from './templateCommands';

export function registerSearchItemProviderCommands(
    context: vscode.ExtensionContext
): vscode.Disposable[] {
    const r = vscode.commands.registerCommand;
    return [
        r('chevron-lists.searchItems',              onSearchItems),
        r('chevron-lists.filterSections',           onFilterSections),
        r('chevron-lists.searchItemsWorkspace',     onSearchItemsWorkspace),
        r('chevron-lists.filterSectionsWorkspace',  onFilterSectionsWorkspace),
        r('chevron-lists.filterByTag',              onFilterByTag),
        r('chevron-lists.filterByTagWorkspace',     onFilterByTagWorkspace),
        r('chevron-lists.filterByPriority',         onFilterByPriority),
        r('chevron-lists.filterByMention',          onFilterByMention),
        r('chevron-lists.filterPinnedSections',     () => onFilterPinnedSections(context)),
        r('chevron-lists.filterGroups',             onFilterGroups),
        r('chevron-lists.toggleItemDone',           onToggleItemDone),
        r('chevron-lists.toggleNote',               onToggleNote),
        r('chevron-lists.togglePin',                () => onTogglePin(context)),
        r('chevron-lists.goToLinkedSection',        onGoToLinkedSection),
        r('chevron-lists.quickCapture',             () => onQuickCapture(context)),
        r('chevron-lists.bulkTagItems',             onBulkTagItems),
        r('chevron-lists.bulkSetPriority',          onBulkSetPriority),
        r('chevron-lists.bulkSetDueDate',           onBulkSetDueDate),
        r('chevron-lists.cloneItem',                onCloneItem),
        r('chevron-lists.cloneItemToSection',       onCloneItemToSection),
        r('chevron-lists.mergeSectionBelow',        onMergeSectionBelow),
        r('chevron-lists.splitSectionHere',         onSplitSectionHere),
        r('chevron-lists.enterReadingMode',         onEnterReadingMode),
        r('chevron-lists.compareSectionToClipboard', onCompareSectionToClipboard),
        r('chevron-lists.archiveDoneItems',         onArchiveDoneItems),
        r('chevron-lists.archiveSection',           onArchiveSection),
        r('chevron-lists.findInSections',           onFindInSections),
        r('chevron-lists.replaceInSection',         onReplaceInSection),
        r('chevron-lists.focusSection',             onFocusSection),
        r('chevron-lists.unfocusSection',           onUnfocusSection),
        r('chevron-lists.addBookmark',              onAddBookmark),
        r('chevron-lists.jumpToBookmark',           onJumpToBookmark),
        r('chevron-lists.removeBookmark',           onRemoveBookmark),
        r('chevron-lists.showSectionSummary',       onShowSectionSummary),
        r('chevron-lists.countItemsByTag',          onCountItemsByTag),
        r('chevron-lists.jumpBack',                 onJumpBack),
        r('chevron-lists.promoteItemToHeader',      onPromoteItemToHeader),
        r('chevron-lists.demoteHeaderToItem',       onDemoteHeaderToItem),
        r('chevron-lists.exportAsMarkdownDoc',      onExportAsMarkdownDoc),
        r('chevron-lists.toggleStar',              onToggleStar),
        r('chevron-lists.filterStarredItems',       onFilterStarredItems),
        r('chevron-lists.exportStatsAsCsv',         onExportStatsAsCsv),
        r('chevron-lists.exportStatsAsJson',        onExportStatsAsJson),
        r('chevron-lists.goToLinkedFile',           onGoToLinkedFile),
        r('chevron-lists.showTimeEstimates',        onShowTimeEstimates),
        r('chevron-lists.showDependencies',         onShowDependencies),
        r('chevron-lists.sortByVotes',              onSortByVotes),
        r('chevron-lists.addVote',                  onAddVote),
        r('chevron-lists.removeVote',               onRemoveVote),
        r('chevron-lists.hideSection',              onHideSection),
        r('chevron-lists.showHiddenSections',       onShowHiddenSections),
        r('chevron-lists.showUpcoming',             onShowUpcoming),
        r('chevron-lists.showRecurring',            onShowRecurring),
        r('chevron-lists.generateNextOccurrence',   onGenerateNextOccurrence),
        r('chevron-lists.setWordCountGoal',         onSetWordCountGoal),
        r('chevron-lists.groupSections',            () => onGroupSections(context)),
        r('chevron-lists.saveSectionAsTemplate',    onSaveSectionAsTemplate),
        r('chevron-lists.switchColourPreset',       onSwitchColourPreset),
        r('chevron-lists.showStatistics',           onShowStatistics),
        r('chevron-lists.insertTemplate',           onInsertTemplate),
        r('chevron-lists.exportAsHtml',             onExportAsHtml),
        r('chevron-lists.exportAsJson',             onExportAsJson),
        r('chevron-lists.exportAsCsv',              onExportAsCsv),
        r('chevron-lists.suggestItems',             onSuggestItems),
        r('chevron-lists.summariseSection',         onSummariseSection),
        r('chevron-lists.expandItem',               onExpandItem),
        vscode.languages.registerHoverProvider({ language: 'markdown' }, new ChevronFileLinkHoverProvider()),
        vscode.languages.registerHoverProvider({ language: 'markdown' }, new ChevronLinkHoverProvider()),
        vscode.languages.registerDefinitionProvider({ language: 'markdown' }, new ChevronLinkDefinitionProvider()),
        vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, new ChevronDocumentLinkProvider()),
    ];
}
