/**
 * settingsPanelCommands.ts
 * Pure data: command groups for the Settings Panel commands tab.
 * buildCommandGroups() is a pure function - fully testable without VS Code.
 */

/** A named group of CL commands shown in the settings panel Commands tab */
export interface CommandGroup {
    group:    string;
    commands: Array<{ id: string; label: string }>;
}

const c = (id: string, label: string) => ({ id: `chevron-lists.${id}`, label });

/** Pure: returns all CL commands organised into display groups */
export function buildCommandGroups(): CommandGroup[] {
    return [
        { group: 'Navigation', commands: [
            c('nextHeader','Next Header'), c('prevHeader','Previous Header'), c('jumpBack','Jump Back'),
            c('addBookmark','Add Bookmark'), c('jumpToBookmark','Jump to Bookmark'), c('removeBookmark','Remove Bookmark'),
            c('showJumpHistory','Jump History'), c('goToLinkedSection','Go to Linked Section'),
            c('goToLinkedFile','Go to Linked File'), c('selectSectionItems','Select Section Items'),
            c('quickCapture','Quick Capture'),
        ]},
        { group: 'Items', commands: [
            c('toggleItemDone','Toggle Done'), c('toggleStar','Star'), c('togglePin','Pin'),
            c('toggleFlag','Flag'), c('toggleNote','Note'), c('addVote','Add Vote'), c('removeVote','Remove Vote'),
            c('stampItem','Stamp'), c('addQuickNote','Add Quick Note'), c('previewItem','Preview'),
            c('duplicateItem','Duplicate'), c('cloneItem','Clone'), c('cloneItemAsDone','Clone as Done'),
            c('cloneItemStripped','Clone Stripped'), c('duplicateItemAndIncrement','Duplicate & Increment'),
            c('moveItemUp','Move Up'), c('moveItemDown','Move Down'),
            c('moveItemToTop','Move to Top'), c('moveItemToBottom','Move to Bottom'),
            c('moveItemToSection','Move to Section'), c('moveItemToFile','Move to File'),
            c('editItemContent','Edit Content'), c('mergeItemWithNext','Merge with Next'), c('splitItemAtCursor','Split at Cursor'),
        ]},
        { group: 'Sections', commands: [
            c('newSection','New Section'), c('renameSection','Rename'), c('deleteSection','Delete'),
            c('duplicateSection','Duplicate'), c('moveSectionUp','Move Up'), c('moveSectionDown','Move Down'),
            c('mergeSectionBelow','Merge Below'), c('splitSectionHere','Split Here'),
            c('archiveSection','Archive'), c('archiveDoneItems','Archive Done Items'),
            c('lockSection','Lock'), c('unlockSection','Unlock'),
            c('freezeSection','Freeze'), c('unfreezeSection','Unfreeze'),
            c('pinSectionToTop','Pin to Top'), c('focusSection','Focus'), c('unfocusSection','Unfocus'),
            c('snapshotSection','Snapshot'), c('cloneSection','Clone'), c('sectionHealthCheck','Health Check'),
            c('insertGroupDivider','Insert Group Divider'),
        ]},
        { group: 'Sort & Filter', commands: [
            c('sortItemsAZ','Items A→Z'), c('sortItemsZA','Items Z→A'),
            c('sortByDueDate','By Due Date'), c('sortByPriority','By Priority'), c('sortByVotes','By Votes'),
            c('sortSectionsAZ','Sections A→Z'), c('sortSectionsZA','Sections Z→A'),
            c('filterSections','Filter Sections'), c('filterByTag','Filter by Tag'),
            c('filterByPriority','Filter by Priority'), c('filterByMention','Filter by Mention'),
            c('filterByRating','Filter by Rating'), c('filterByColourLabel','Filter by Colour'),
            c('filterByMultipleTags','Filter by Multiple Tags'),
            c('filterStarredItems','Starred'), c('filterFlaggedItems','Flagged'), c('filterPinnedSections','Pinned'),
            c('searchItems','Search Items'), c('searchItemsWorkspace','Search Workspace'),
        ]},
        { group: 'Numbering', commands: [
            c('renumberItems','Renumber'), c('fixNumbering','Fix Numbering'),
            c('convertBulletsToNumbered','Bullets → Numbered'), c('convertNumberedToBullets','Numbered → Bullets'),
            c('setListStartNumber','Set Start Number'), c('rebaseListFromHere','Rebase From Here'),
            c('offsetListNumbers','Offset Numbers'),
        ]},
        { group: 'Export & Copy', commands: [
            c('copySectionAsMarkdown','Copy as Markdown'), c('copySectionAsPlainText','Copy as Plain Text'),
            c('copySectionAsJson','Copy as JSON'), c('copySectionAsHtml','Copy as HTML'),
            c('exportAsHtml','Export as HTML'), c('exportAsJson','Export as JSON'),
            c('exportAsCsv','Export as CSV'), c('exportAsMarkdownDoc','Export as Markdown'),
            c('exportToObsidian','Export to Obsidian'), c('exportAllSectionsAsJson','Export All as JSON'),
            c('copyItemAsMarkdown','Copy Item as Markdown'), c('insertTableOfContents','Insert TOC'),
        ]},
        { group: 'Views & Stats', commands: [
            c('showStatistics','Statistics'), c('showWorkspaceStatistics','Workspace Stats'),
            c('showKanban','Kanban'), c('todayView','Today View'), c('showUpcoming','Upcoming'),
            c('showProgressReport','Progress Report'), c('showPrioritySummary','Priority Summary'),
            c('showTagStats','Tag Stats'), c('showMentionsReport','Mentions Report'),
            c('showWordCount','Word Count'), c('showReadingTime','Reading Time'),
            c('showAgeStats','Age Stats'), c('showWordCloud','Word Cloud'), c('quickStats','Quick Stats'),
        ]},
        { group: 'AI', commands: [
            c('suggestItems','Suggest Items'), c('summariseSection','Summarise Section'),
            c('expandItem','Expand Item'), c('rewriteItem','Rewrite Item'),
        ]},
        { group: 'Text & Transform', commands: [
            c('uppercaseItem','UPPERCASE'), c('lowercaseItem','lowercase'), c('titleCaseItem','Title Case'),
            c('boldText','Bold'), c('italicText','Italic'), c('underlineText','Underline'),
            c('monoText','Mono'), c('strikeText','Strikethrough'), c('textTransformPalette','Transform…'),
            c('wrapItemText','Wrap Text'), c('stripAllMetadata','Strip Metadata'),
        ]},
        { group: 'Decorations', commands: [
            c('toggleSummaryDecoration','Section Summary'), c('toggleChecklistBar','Checklist Bar'),
            c('toggleWordGoalBar','Word Goal Bar'), c('toggleAgeHighlight','Age Highlight'),
            c('toggleAllDecorations','All Decorations'), c('toggleFocusMode','Focus Mode'),
            c('switchColourPreset','Colour Theme'), c('toggleItemCountBadge','Item Count Badge'),
            c('showTipOfDay','Tip of the Day'),
        ]},
    ];
}
