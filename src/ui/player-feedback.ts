import type { SimEvent } from '../simulation/types';

/** Personal UI cues belong to the controlled champion; system notices have no owner. */
export function isPlayerFeedback(event: SimEvent, playerId: number): boolean {
  switch (event.type) {
    case 'message':
    case 'move':
    case 'gold':
    case 'level':
      return event.unit === undefined || event.unit === playerId;
    default:
      return true;
  }
}
