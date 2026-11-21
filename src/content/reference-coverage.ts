import { PUBLIC_SELECTABLE_CHAMPIONS, CHAMPION_PROFILES } from './champion-profiles';
import { PLAYER_CHAMPION_ROLES } from './champion-roles';
import { DARIUS_KIT, VI_KIT, EZREAL_KIT, MORGANA_KIT } from './milestone6-champions';
import { ROLE_QUESTS } from './role-quests';
import { KEYSTONES, SECONDARY_RUNES } from './runes';
import { ITEMS } from './rules';
import { TRINKETS } from './trinkets';
import { DRAGON_ELEMENTS, DRAGON_ELEMENT_NAMES, DRAGON_SOUL_NAMES } from './epic-objectives';

export type CoverageStatus =
  'verified-behavior' | 'verified-data' | 'approximation' | 'unimplemented';

export type AssetProvenance =
  'riot-16.18-wad' | 'ddragon-16.18.1' | 'authored-local-milestone6' | 'simulation-rule';

export type CoverageCategory =
  'champion' | 'ability' | 'role-quest' | 'objective' | 'vision' | 'item' | 'rune' | 'system';

export interface ReferenceCoverageEntry {
  id: string;
  category: CoverageCategory;
  name: string;
  patch: '26.18';
  status: CoverageStatus;
  assetProvenance: AssetProvenance;
  sourceReference: string;
  implementationRef: string;
  testScenario: string;
  playerDeviationNote: string | null;
}

const LEGACY_ABILITY_NAMES: Readonly<
  Record<
    'ashe' | 'lux' | 'garen' | 'masteryi' | 'leona' | 'ahri',
    Readonly<Record<'p' | 'q' | 'w' | 'e' | 'r', string>>
  >
> = {
  ashe: {
    p: 'Frost Shot',
    q: 'Ranger’s Focus',
    w: 'Volley',
    e: 'Hawkshot',
    r: 'Enchanted Crystal Arrow',
  },
  lux: {
    p: 'Illumination',
    q: 'Light Binding',
    w: 'Prismatic Barrier',
    e: 'Lucent Singularity',
    r: 'Final Spark',
  },
  garen: {
    p: 'Perseverance',
    q: 'Decisive Strike',
    w: 'Courage',
    e: 'Judgment',
    r: 'Demacian Justice',
  },
  masteryi: {
    p: 'Double Strike',
    q: 'Alpha Strike',
    w: 'Meditate',
    e: 'Wuju Style',
    r: 'Highlander',
  },
  leona: {
    p: 'Sunlight',
    q: 'Shield of Daybreak',
    w: 'Eclipse',
    e: 'Zenith Blade',
    r: 'Solar Flare',
  },
  ahri: {
    p: 'Essence Theft',
    q: 'Orb of Deception',
    w: 'Fox-Fire',
    e: 'Charm',
    r: 'Spirit Rush',
  },
};

const M6_ABILITY_NAMES = {
  darius: {
    p: DARIUS_KIT.passive.name,
    q: DARIUS_KIT.q.name,
    w: DARIUS_KIT.w.name,
    e: DARIUS_KIT.e.name,
    r: DARIUS_KIT.r.name,
  },
  vi: {
    p: VI_KIT.passive.name,
    q: VI_KIT.q.name,
    w: VI_KIT.w.name,
    e: VI_KIT.e.name,
    r: VI_KIT.r.name,
  },
  ezreal: {
    p: EZREAL_KIT.passive.name,
    q: EZREAL_KIT.q.name,
    w: EZREAL_KIT.w.name,
    e: EZREAL_KIT.e.name,
    r: EZREAL_KIT.r.name,
  },
  morgana: {
    p: MORGANA_KIT.passive.name,
    q: MORGANA_KIT.q.name,
    w: MORGANA_KIT.w.name,
    e: MORGANA_KIT.e.name,
    r: MORGANA_KIT.r.name,
  },
} as const;

const SYSTEM_ENTRIES: readonly ReferenceCoverageEntry[] = [
  {
    id: 'system:fixed-clock-60hz',
    category: 'system',
    name: '60 Hz Fixed Planar Simulation & Command Replay',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'simulation-rule',
    sourceReference: 'docs/DESIGN.md#6-simulation-clock-state-and-input',
    implementationRef: 'src/simulation/world.ts',
    testScenario: 'tests/milestone5-replay-and-mix.test.ts',
    playerDeviationNote:
      'Runs on a deterministic 60 Hz local tick clock rather than Riot’s 30 Hz server tick rate.',
  },
  {
    id: 'system:rift-navigation-vision',
    category: 'system',
    name: 'Summoner’s Rift Source NavGrid, Brush & Fog of War',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'riot-16.18-wad',
    sourceReference: 'docs/MAP-ASSETS.md',
    implementationRef: 'src/simulation/navgrid.ts',
    testScenario: 'tests/vision.test.ts',
    playerDeviationNote: null,
  },
  {
    id: 'system:minion-waves-inhibitors',
    category: 'system',
    name: 'Three-Lane Minion Waves, Super Minions & Inhibitor Regrowth',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'riot-16.18-wad',
    sourceReference: 'docs/reference/lane-minion-records.json',
    implementationRef: 'src/content/rift.ts',
    testScenario: 'tests/lane-match.test.ts',
    playerDeviationNote: null,
  },
  {
    id: 'system:turret-aggro-structures',
    category: 'system',
    name: 'Turret Aggression, Base Protection & Nexus Destruction',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'riot-16.18-wad',
    sourceReference: 'docs/STRUCTURES.md',
    implementationRef: 'src/simulation/world.ts',
    testScenario: 'tests/match-contract.test.ts',
    playerDeviationNote:
      'Outer turret plating gold milestones and Crystalline Overgrowth use streamlined structure hit rewards.',
  },
  {
    id: 'system:ambient-bounty-economy',
    category: 'system',
    name: 'Ambient Gold (10.2g/5s after 1:05), Last-Hit, Kill/Assist & Shop Undo',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'riot-16.18-wad',
    sourceReference: 'docs/ECONOMY.md',
    implementationRef: 'src/content/ambient-gold.ts',
    testScenario: 'tests/milestone6-systems.test.ts',
    playerDeviationNote: null,
  },
  {
    id: 'system:crowd-control-tenacity',
    category: 'system',
    name: 'Capability Crowd Control, Tenacity, Slows, Stasis & Black Shield Immunity',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'simulation-rule',
    sourceReference: 'docs/DESIGN.md#8-combat-where-clone-accuracy-is-won',
    implementationRef: 'src/simulation/world.ts',
    testScenario: 'tests/milestone6-systems.test.ts',
    playerDeviationNote: null,
  },
  {
    id: 'system:non-mirror-10-champion-5v5',
    category: 'system',
    name: '10-Champion Zero-Mirror 5v5 Role Matchmaking & Hierarchical Bot AI',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'simulation-rule',
    sourceReference: 'docs/ROADMAP.md#milestone-6--reference-mode-audit-and-expansion',
    implementationRef: 'src/simulation/lane-match.ts',
    testScenario: 'tests/milestone6-roster-contract.test.ts',
    playerDeviationNote: null,
  },
];

function buildReferenceCoverage(): readonly ReferenceCoverageEntry[] {
  const entries: ReferenceCoverageEntry[] = [...SYSTEM_ENTRIES];

  // 1. All 10 Champions + 50 Abilities (Passive + Q/W/E/R)
  for (const id of PUBLIC_SELECTABLE_CHAMPIONS) {
    const profile = CHAMPION_PROFILES[id];
    const role = PLAYER_CHAMPION_ROLES[id];
    const isM6 = id === 'darius' || id === 'vi' || id === 'ezreal' || id === 'morgana';
    entries.push({
      id: `champion:${id}`,
      category: 'champion',
      name: `${profile.name} (${role.toUpperCase()})`,
      patch: '26.18',
      status: isM6 ? 'approximation' : 'verified-behavior',
      assetProvenance: isM6 ? 'authored-local-milestone6' : 'riot-16.18-wad',
      sourceReference: isM6
        ? 'src/content/milestone6-champions.ts (Patch 26.18 normalized profile)'
        : `docs/reference/champion-sample.json (${profile.name})`,
      implementationRef: isM6
        ? 'src/simulation/milestone6-champions.ts'
        : 'src/simulation/world.ts',
      testScenario: 'tests/milestone6-roster-contract.test.ts',
      playerDeviationNote: isM6
        ? `${profile.name} uses an authored skeletal GLB 2.0 rig, procedural 3D VFX, and Web Audio synthesis while external Riot WAD archives are offline.`
        : null,
    });

    const abilityNames = isM6 ? M6_ABILITY_NAMES[id] : LEGACY_ABILITY_NAMES[id];
    for (const slot of ['p', 'q', 'w', 'e', 'r'] as const) {
      entries.push({
        id: `ability:${id}:${slot}`,
        category: 'ability',
        name: `${profile.name} ${slot.toUpperCase()} — ${abilityNames[slot]}`,
        patch: '26.18',
        status: isM6 ? 'approximation' : 'verified-behavior',
        assetProvenance: isM6 ? 'authored-local-milestone6' : 'riot-16.18-wad',
        sourceReference: isM6
          ? `src/content/milestone6-champions.ts#${id}.${slot}`
          : `docs/reference/${id === 'masteryi' ? 'masteryi' : id}`,
        implementationRef: isM6
          ? 'src/simulation/milestone6-champions.ts'
          : 'src/simulation/world.ts',
        testScenario: 'tests/milestone6-roster-contract.test.ts',
        playerDeviationNote: isM6
          ? 'Kit numbers and state transitions match Patch 26.18 design; visual/audio assets are locally authored.'
          : null,
      });
    }
  }

  // 2. All 5 Role Quests
  for (const role of ['top', 'jungle', 'mid', 'carry', 'support'] as const) {
    const q = ROLE_QUESTS[role];
    entries.push({
      id: `role-quest:${role}`,
      category: 'role-quest',
      name: `${q.name} → ${q.rewardName}`,
      patch: '26.18',
      status: role === 'jungle' ? 'verified-data' : 'approximation',
      assetProvenance: role === 'jungle' ? 'riot-16.18-wad' : 'simulation-rule',
      sourceReference: 'docs/DESIGN.md#3-fidelity-contract-and-reference-version',
      implementationRef: 'src/simulation/role-quests.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        role === 'jungle'
          ? null
          : 'Season 2026 role quest thresholds use deterministic local CS/combat/tribute milestones (Top Lv.20 cap, Carry 7th slot, Mid 4s recall & stride, Support 4-ward cap).',
    });
  }

  // 3. Objectives (Baron, Voidgrubs, Rift Herald, 6 Elemental Drakes, 6 Souls, Elder, Scuttler, 6 Camps)
  entries.push(
    {
      id: 'objective:baron-nashor',
      category: 'objective',
      name: 'Baron Nashor & Hand of Baron (20:00)',
      patch: '26.18',
      status: 'verified-behavior',
      assetProvenance: 'riot-16.18-wad',
      sourceReference: 'docs/BARON-ENCOUNTER.md',
      implementationRef: 'src/simulation/world.ts',
      testScenario: 'tests/rift-baron.test.ts',
      playerDeviationNote: null,
    },
    {
      id: 'objective:voidgrubs',
      category: 'objective',
      name: 'Voidgrubs (SRU_Horde) & Touch of the Void (06:00–14:45)',
      patch: '26.18',
      status: 'verified-data',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: 'docs/reference/epic-character-source.json#sru_horde',
      implementationRef: 'src/simulation/epic-objectives.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        'Uses pinned 16.18 Map11 spawn/despawn coordinates and SRU_Horde stats with an authored GLB rig; Voidmites on 4+ stacks are simplified into Touch of the Void true-damage burn.',
    },
    {
      id: 'objective:rift-herald',
      category: 'objective',
      name: 'Rift Herald (SRU_RiftHerald) & Siege Charge (15:00–19:45)',
      patch: '26.18',
      status: 'verified-data',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: 'docs/reference/epic-character-source.json#sru_riftherald',
      implementationRef: 'src/simulation/epic-objectives.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        'Uses pinned 16.18 SRU_RiftHerald stats and pit timers; grants direct Siege Charge true damage on the holder’s next turret attack instead of a rideable mercenary vehicle.',
    },
    {
      id: 'objective:elder-dragon',
      category: 'objective',
      name: 'Elder Dragon & Aspect of the Dragon (20% Execute)',
      patch: '26.18',
      status: 'verified-data',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: 'docs/reference/epic-character-source.json#sru_dragon_elder',
      implementationRef: 'src/simulation/epic-objectives.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        'Uses pinned 16.18 SRU_Dragon_Elder stats (11,500 base HP) with an authored Elder Dragon GLB rig.',
    },
    {
      id: 'objective:rift-scuttler',
      category: 'objective',
      name: 'Rift Scuttler & Speed Shrine',
      patch: '26.18',
      status: 'verified-behavior',
      assetProvenance: 'riot-16.18-wad',
      sourceReference: 'docs/reference/scuttler-source.json',
      implementationRef: 'src/simulation/scuttler.ts',
      testScenario: 'tests/scuttler.test.ts',
      playerDeviationNote: null,
    },
    {
      id: 'objective:jungle-camps',
      category: 'objective',
      name: 'Six Standard Jungle Camps (Blue, Red, Gromp, Wolves, Raptors, Krugs)',
      patch: '26.18',
      status: 'verified-behavior',
      assetProvenance: 'riot-16.18-wad',
      sourceReference: 'docs/reference/jungle-character-source.json',
      implementationRef: 'src/content/rift-camps.ts',
      testScenario: 'tests/bot-jungle.test.ts',
      playerDeviationNote: null,
    }
  );

  for (const el of DRAGON_ELEMENTS) {
    entries.push({
      id: `objective:dragon-${el}`,
      category: 'objective',
      name: `${DRAGON_ELEMENT_NAMES[el]} & ${DRAGON_SOUL_NAMES[el]}`,
      patch: '26.18',
      status: 'verified-data',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: `docs/reference/epic-character-source.json#sru_dragon_${el}`,
      implementationRef: 'src/simulation/epic-objectives.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        'Uses pinned 16.18 SRU_Dragon stats, Slayer stacks, Soul passives, and Elemental Faelights; terrain wall meshes remain in base Rift geometry.',
    });
  }

  // 4. Vision Variants (Trinkets + Control Ward + Faelights)
  for (const kind of Object.keys(TRINKETS) as (keyof typeof TRINKETS)[]) {
    const isFarsight = kind === 'farsight';
    entries.push({
      id: `vision:trinket:${kind}`,
      category: 'vision',
      name: `Trinket — ${TRINKETS[kind].name}`,
      patch: '26.18',
      status: isFarsight ? 'approximation' : 'verified-behavior',
      assetProvenance: isFarsight ? 'authored-local-milestone6' : 'riot-16.18-wad',
      sourceReference: isFarsight ? 'src/content/faelights.ts' : 'docs/WARDING-TOTEM.md',
      implementationRef: 'src/simulation/wards.ts',
      testScenario: isFarsight ? 'tests/milestone6-systems.test.ts' : 'tests/oracle-lens.test.ts',
      playerDeviationNote: isFarsight
        ? 'Unlocks at Lv. 9 with 4,000 cast range, 2s area reveal, and fragile 1-HP visible ward using an authored crystal GLB rig.'
        : null,
    });
  }
  entries.push(
    {
      id: 'vision:control-ward',
      category: 'vision',
      name: 'Control Ward (75g True-Sight Jammer)',
      patch: '26.18',
      status: 'approximation',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: 'src/content/faelights.ts#CONTROL_WARD_POLICY',
      implementationRef: 'src/simulation/wards.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote: null,
    },
    {
      id: 'vision:faelights',
      category: 'vision',
      name: 'Season 2026 Faelight Ward Zones & Elemental Faelights',
      patch: '26.18',
      status: 'approximation',
      assetProvenance: 'simulation-rule',
      sourceReference: 'docs/DESIGN.md#7-map-camera-navigation-and-vision',
      implementationRef: 'src/content/faelights.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote:
        'Faelight rings grant +25% ward sight radius and a 45s bonus vision zone at authored river/mid entrances.',
    }
  );

  // 5. Complete Item Catalog
  for (const item of ITEMS) {
    const authored = 'category' in item;
    entries.push({
      id: `item:${item.id}`,
      category: 'item',
      name: `${item.name} (${item.price}g)`,
      patch: '26.18',
      status: authored ? 'approximation' : 'verified-data',
      assetProvenance: authored ? 'authored-local-milestone6' : 'ddragon-16.18.1',
      sourceReference: authored ? 'src/content/expanded-items.ts' : 'src/content/rules.ts',
      implementationRef: 'src/simulation/world.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote: authored
        ? 'Icon authored locally; stats, uniqueness group, recipe, and passive/active effects execute deterministically.'
        : null,
    });
  }

  // 6. Selected Runes (Keystones + Secondary Runes + Shards)
  for (const k of Object.values(KEYSTONES)) {
    entries.push({
      id: `rune:keystone:${k.id}`,
      category: 'rune',
      name: `Keystone (${k.path}) — ${k.name}`,
      patch: '26.18',
      status: 'approximation',
      assetProvenance: 'authored-local-milestone6',
      sourceReference: 'src/content/runes.ts',
      implementationRef: 'src/simulation/runes.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote: null,
    });
  }
  for (const s of Object.values(SECONDARY_RUNES)) {
    entries.push({
      id: `rune:secondary:${s.id}`,
      category: 'rune',
      name: `Secondary Rune — ${s.name}`,
      patch: '26.18',
      status: 'approximation',
      assetProvenance: 'simulation-rule',
      sourceReference: 'src/content/runes.ts',
      implementationRef: 'src/simulation/runes.ts',
      testScenario: 'tests/milestone6-systems.test.ts',
      playerDeviationNote: null,
    });
  }
  entries.push({
    id: 'rune:stat-shards',
    category: 'rune',
    name: 'Offense, Flex & Defense Stat Shards',
    patch: '26.18',
    status: 'verified-behavior',
    assetProvenance: 'simulation-rule',
    sourceReference: 'src/content/runes.ts#STAT_SHARD_LABELS',
    implementationRef: 'src/simulation/runes.ts',
    testScenario: 'tests/milestone6-systems.test.ts',
    playerDeviationNote: null,
  });

  return entries;
}

export const REFERENCE_COVERAGE_LEDGER: readonly ReferenceCoverageEntry[] =
  buildReferenceCoverage();

export function summarizeReferenceCoverage(
  entries: readonly ReferenceCoverageEntry[] = REFERENCE_COVERAGE_LEDGER
) {
  const byStatus: Record<CoverageStatus, number> = {
    'verified-behavior': 0,
    'verified-data': 0,
    approximation: 0,
    unimplemented: 0,
  };
  const byCategory: Record<CoverageCategory, number> = {
    champion: 0,
    ability: 0,
    'role-quest': 0,
    objective: 0,
    vision: 0,
    item: 0,
    rune: 0,
    system: 0,
  };
  let deviations = 0;
  for (const entry of entries) {
    byStatus[entry.status]++;
    byCategory[entry.category]++;
    if (entry.playerDeviationNote) deviations++;
  }
  return {
    patch: '26.18' as const,
    totalEntries: entries.length,
    byStatus,
    byCategory,
    documentedDeviations: deviations,
  };
}
