import type { Vec2 } from '../simulation/math';
import { TICK_RATE } from './rules';

export interface FaelightNode extends Vec2 {
  id: string;
  name: string;
  radius: number;
  /** Elemental Rift transformation unlocks two additional river-wall Faelights. */
  elementalOnly?: true;
}

/**
 * Season 2026 Summoner's Rift Faelight ward rings.
 * Placing a ward inside a Faelight ring empowers its vision radius (+25%)
 * and emits a temporary bonus vision bloom for 45 seconds.
 */
export const FAELIGHT_NODES: readonly FaelightNode[] = [
  {
    id: 'faelight-top-river-order',
    name: 'Order Top River Faelight',
    x: -3480,
    y: -1580,
    radius: 185,
  },
  {
    id: 'faelight-top-river-chaos',
    name: 'Chaos Top River Faelight',
    x: -1620,
    y: -3440,
    radius: 185,
  },
  {
    id: 'faelight-bot-river-order',
    name: 'Order Bot River Faelight',
    x: 1620,
    y: 3440,
    radius: 185,
  },
  {
    id: 'faelight-bot-river-chaos',
    name: 'Chaos Bot River Faelight',
    x: 3480,
    y: 1580,
    radius: 185,
  },
  {
    id: 'faelight-elemental-mid-north',
    name: 'Elemental North Mid Faelight',
    x: -1120,
    y: -1120,
    radius: 185,
    elementalOnly: true,
  },
  {
    id: 'faelight-elemental-mid-south',
    name: 'Elemental South Mid Faelight',
    x: 1120,
    y: 1120,
    radius: 185,
    elementalOnly: true,
  },
] as const;

export const FAELIGHT_POLICY = {
  sightMultiplier: 1.25,
  bonusVisionRadius: 450,
  bonusVisionTicks: 45 * TICK_RATE,
  enemyRevealPulseTicks: 3 * TICK_RATE,
} as const;

export const FARSIGHT_POLICY = {
  minLevel: 9,
  range: 4000,
  sightRadius: 500,
  arrivalRevealRadius: 800,
  arrivalRevealTicks: 2 * TICK_RATE,
  earlyRechargeSeconds: 198,
  lateRechargeSeconds: 99,
  cooldownTicks: Math.round(1.0 * TICK_RATE),
  placementTicks: Math.round(0.25 * TICK_RATE),
  killGold: 15,
  rig: 'farsightward-base' as const,
} as const;

export const CONTROL_WARD_POLICY = {
  itemId: 'control-ward',
  price: 75,
  sell: 30,
  maxInventoryStack: 2,
  range: 625,
  health: 4,
  sightRadius: 900,
  jamRadius: 900,
  killGold: 30,
  placementTicks: Math.round(0.25 * TICK_RATE),
  rig: 'controlward-base' as const,
} as const;

export function matchingFaelight(point: Vec2, elementalRiftActive: boolean): FaelightNode | null {
  for (const node of FAELIGHT_NODES) {
    if (node.elementalOnly && !elementalRiftActive) continue;
    if (Math.hypot(point.x - node.x, point.y - node.y) <= node.radius) return node;
  }
  return null;
}
