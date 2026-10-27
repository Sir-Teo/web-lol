import { expect, test, vi } from 'vitest';
const cases = [
  {
    lazy: 'lazy-garen-basic-attacks',
    lazyClass: 'LazyGarenBasicAttacks',
    module: 'garen-basic-attacks',
    load: 'loadGarenBasicAttacks',
    renderer: 'GarenBasicAttacks',
    disposed: false,
  },
  {
    lazy: 'lazy-garen-courage',
    lazyClass: 'LazyGarenCourage',
    module: 'garen-courage',
    load: 'loadGarenCourage',
    renderer: 'GarenCourage',
    disposed: false,
  },
  {
    lazy: 'lazy-garen-decisive-strike',
    lazyClass: 'LazyGarenDecisiveStrike',
    module: 'garen-decisive-strike',
    load: 'loadGarenDecisiveStrike',
    renderer: 'GarenDecisiveStrike',
    disposed: false,
  },
  {
    lazy: 'lazy-garen-justice',
    lazyClass: 'LazyGarenJustice',
    module: 'garen-justice',
    load: 'loadGarenJustice',
    renderer: 'GarenJustice',
    disposed: false,
  },
  {
    lazy: 'lazy-garen-perseverance',
    lazyClass: 'LazyGarenPerseverance',
    module: 'garen-perseverance',
    load: 'loadGarenPerseverance',
    renderer: 'GarenPerseverance',
    disposed: false,
  },
  {
    lazy: 'lazy-gromp-attack',
    lazyClass: 'LazyGrompAttack',
    module: 'gromp-attack',
    load: 'loadGrompAttack',
    renderer: 'GrompAttack',
    disposed: false,
  },
  {
    lazy: 'lazy-gromp-death',
    lazyClass: 'LazyGrompDeath',
    module: 'gromp-death',
    load: 'loadGrompDeath',
    renderer: 'GrompDeath',
    disposed: false,
  },
  {
    lazy: 'lazy-leona-daybreak',
    lazyClass: 'LazyLeonaDaybreak',
    module: 'leona-daybreak',
    load: 'loadLeonaDaybreak',
    renderer: 'LeonaDaybreak',
    disposed: false,
  },
  {
    lazy: 'lazy-leona-eclipse-skins',
    lazyClass: 'LazyLeonaEclipseSkins',
    module: 'leona-eclipse-skins',
    load: 'loadLeonaEclipseSkins',
    renderer: 'LeonaEclipseSkins',
    disposed: false,
  },
  {
    lazy: 'lazy-leona-eclipse-surfaces',
    lazyClass: 'LazyLeonaEclipseSurfaces',
    module: 'leona-eclipse-surfaces',
    load: 'loadLeonaEclipseSurfaces',
    renderer: 'LeonaEclipseSurfaces',
    disposed: false,
  },
  {
    lazy: 'lazy-leona-solar-projections',
    lazyClass: 'LazyLeonaSolarProjections',
    module: 'leona-solar-projections',
    load: 'loadLeonaSolarProjections',
    renderer: 'LeonaSolarProjections',
    disposed: true,
  },
  {
    lazy: 'lazy-leona-solar-skins',
    lazyClass: 'LazyLeonaSolarSkins',
    module: 'leona-solar-skins',
    load: 'loadLeonaSolarSkins',
    renderer: 'LeonaSolarSkins',
    disposed: true,
  },
  {
    lazy: 'lazy-leona-solar-surfaces',
    lazyClass: 'LazyLeonaSolarSurfaces',
    module: 'leona-solar-surfaces',
    load: 'loadLeonaSolarSurfaces',
    renderer: 'LeonaSolarSurfaces',
    disposed: true,
  },
  {
    lazy: 'lazy-leona-zenith-skins',
    lazyClass: 'LazyLeonaZenithSkins',
    module: 'leona-zenith-skins',
    load: 'loadLeonaZenithSkins',
    renderer: 'LeonaZenithSkins',
    disposed: true,
  },
  {
    lazy: 'lazy-leona-zenith-surfaces',
    lazyClass: 'LazyLeonaZenithSurfaces',
    module: 'leona-zenith-surfaces',
    load: 'loadLeonaZenithSurfaces',
    renderer: 'LeonaZenithSurfaces',
    disposed: true,
  },
  {
    lazy: 'lazy-leona-zenith-trails',
    lazyClass: 'LazyLeonaZenithTrails',
    module: 'leona-zenith-ribbons',
    load: 'loadLeonaZenithTrails',
    renderer: 'LeonaZenithRibbons',
    disposed: true,
  },
  {
    lazy: 'lazy-masteryi-passive-trails',
    lazyClass: 'LazyPassiveTrails',
    module: 'masteryi-passive-trails',
    load: 'loadPassiveTrails',
    renderer: 'PassiveTrails',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-primary-hits',
    lazyClass: 'LazyPrimaryHits',
    module: 'masteryi-primary-hits',
    load: 'loadPrimaryHits',
    renderer: 'PrimaryHits',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-primary-trails',
    lazyClass: 'LazyPrimaryTrails',
    module: 'masteryi-primary-trails',
    load: 'loadPrimaryTrails',
    renderer: 'PrimaryTrails',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-q-casts',
    lazyClass: 'LazyAlphaCasts',
    module: 'masteryi-q-casts',
    load: 'loadAlphaCasts',
    renderer: 'AlphaCasts',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-q-contacts',
    lazyClass: 'LazyAlphaContacts',
    module: 'masteryi-q-contacts',
    load: 'loadAlphaContacts',
    renderer: 'AlphaContacts',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-q-ends',
    lazyClass: 'LazyAlphaEnds',
    module: 'masteryi-q-ends',
    load: 'loadAlphaEnds',
    renderer: 'AlphaEnds',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-r-casts',
    lazyClass: 'LazyHighlanderCasts',
    module: 'masteryi-r-casts',
    load: 'loadHighlanderCasts',
    renderer: 'HighlanderCasts',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-r-kills',
    lazyClass: 'LazyHighlanderKills',
    module: 'masteryi-r-kills',
    load: 'loadHighlanderKills',
    renderer: 'HighlanderKills',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-sword-glows',
    lazyClass: 'LazySwordGlows',
    module: 'masteryi-sword-glows',
    load: 'loadSwordGlows',
    renderer: 'SwordGlows',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-w-buffs',
    lazyClass: 'LazyMeditateBuffs',
    module: 'masteryi-w-buffs',
    load: 'loadMeditateBuffs',
    renderer: 'MeditateBuffs',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-w-casts',
    lazyClass: 'LazyMeditateCasts',
    module: 'masteryi-w-casts',
    load: 'loadMeditateCasts',
    renderer: 'MeditateCasts',
    disposed: false,
  },
  {
    lazy: 'lazy-masteryi-w-damage',
    lazyClass: 'LazyMeditateDamage',
    module: 'masteryi-w-damage',
    load: 'loadMeditateDamage',
    renderer: 'MeditateDamage',
    disposed: false,
  },
  {
    lazy: 'lazy-sunlight',
    lazyClass: 'LazySunlight',
    module: 'sunlight',
    load: 'loadSunlight',
    renderer: 'Sunlight',
    disposed: false,
  },
];
for (const item of cases)
  test(`${item.lazyClass} paints once after shared loading completes`, async () => {
    vi.resetModules();
    const path = '../src/render/' + item.module;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      prepare = vi.fn(() => gate),
      models = new Map(),
      instances: any[] = [];
    vi.doMock(path, () => ({
      [item.load]: prepare,
      [item.renderer]: class {
        models = models;
        constructor(...args: any[]) {
          instances.push(args);
        }
      },
    }));
    try {
      const module = await import('../src/render/' + item.lazy),
        loader = new module[item.lazyClass]({}, () => 0),
        ready = vi.fn(() => expect(loader.models).toBe(models));
      loader.onReady = ready;
      const first = loader.load(),
        second = loader.load();
      expect(second).toBe(first);
      await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
      expect(instances).toHaveLength(0);
      expect(ready).not.toHaveBeenCalled();
      release();
      await Promise.all([first, second]);
      expect(instances).toHaveLength(1);
      expect(ready).toHaveBeenCalledTimes(1);
      await loader.load();
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(ready).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock(path);
      vi.resetModules();
    }
  });
for (const item of cases.filter((row) => row.disposed))
  test(`${item.lazyClass} does not wake a disposed view`, async () => {
    vi.resetModules();
    const path = '../src/render/' + item.module;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      prepare = vi.fn(() => gate),
      create = vi.fn();
    vi.doMock(path, () => ({
      [item.load]: prepare,
      [item.renderer]: class {
        constructor() {
          create();
        }
      },
    }));
    try {
      const module = await import('../src/render/' + item.lazy),
        loader = new module[item.lazyClass]({}, () => 0),
        ready = vi.fn();
      loader.onReady = ready;
      const pending = loader.load();
      await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
      loader.dispose();
      release();
      await pending;
      expect(create).not.toHaveBeenCalled();
      expect(ready).not.toHaveBeenCalled();
      await expect(loader.load()).rejects.toThrow(/disposed/);
    } finally {
      vi.doUnmock(path);
      vi.resetModules();
    }
  });
test('failed Garen preparation stays asleep and an explicit retry paints the completed renderer', async () => {
  vi.resetModules();
  const path = '../src/render/garen-justice',
    prepare = vi
      .fn()
      .mockRejectedValueOnce(Error('injected load failure'))
      .mockResolvedValue(undefined);
  vi.doMock(path, () => ({
    loadGarenJustice: prepare,
    GarenJustice: class {
      models = new Map();
    },
  }));
  try {
    const { LazyGarenJustice } = await import('../src/render/lazy-garen-justice'),
      loader = new LazyGarenJustice({} as any, () => 0),
      ready = vi.fn();
    loader.onReady = ready;
    await expect(loader.load()).rejects.toThrow('injected load failure');
    expect(ready).not.toHaveBeenCalled();
    await loader.load();
    expect(ready).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(2);
  } finally {
    vi.doUnmock(path);
    vi.resetModules();
  }
});
