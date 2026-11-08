import { extractSortDate } from './patterns';
import { sortSectionBy } from './sortCommands';

/** Command: sorts items in the section by @YYYY-MM-DD, soonest first and undated last, keeping nested items with their parent */
export const onSortByDueDate = () => sortSectionBy((a, b) => extractSortDate(a).localeCompare(extractSortDate(b)), 'CL: Sorted by due date');
