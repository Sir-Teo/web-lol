import { COMPANION_ITEMS } from './companion-items';
import type { CompanionKind } from './companion-policy';

export function companionItemKind(itemId: string): CompanionKind | undefined {
  return COMPANION_ITEMS.find((item) => item.id === itemId)?.id;
}
/** Members of the DoransItems starter uniqueness group. */
export const isDoranStarter = (itemId: string | null) =>
  itemId === 'blade' || itemId === 'dorans-ring' || itemId === 'dorans-shield';
