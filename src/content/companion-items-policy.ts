import { COMPANION_ITEMS } from './companion-items';
import type { CompanionKind } from './companion-policy';

export function companionItemKind(itemId: string): CompanionKind | undefined {
  return COMPANION_ITEMS.find((item) => item.id === itemId)?.id;
}
/** The current catalog's other member of the source DoransItems group. */
export const isDoranStarter = (itemId: string | null) => itemId === 'blade';
