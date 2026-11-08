import { splitItem } from './itemParts';
import { sortSectionBy } from './sortCommands';

const priorityOf = (content: string): number => splitItem(content).priority.length;

/** Command: sorts items in the section by priority, highest first, keeping nested items with their parent */
export const onSortByPriority = () => sortSectionBy((a, b) => priorityOf(b) - priorityOf(a), 'CL: Sorted by priority');
