// Generated unflattened source graph. Finite Recall source graph. Zero instance declarations stay raw; native dispatch/inheritance remain unverified.
export const AHRI_RECALL_AUDIO = {
  readingSha256: 'c3152a7031db137fc1c6a787d646771b15cc0e7beccdea79aeb431471522965b',
  events: [
    {
      role: 'recall',
      id: 3665710094,
      declaredName: 'Play_sfx_Ahri_Recall3D_buffactivate',
      actions: [
        {
          id: 37101235,
          type: 'CAkActionPlay',
          target: 491713706,
          properties: {},
          fadeCurve: 4,
          actionType: 1027,
        },
      ],
    },
  ],
  containers: [
    {
      id: 491713706,
      parentId: 693628260,
      busId: 0,
      properties: {
        MakeUpGain: -5.0,
      },
      ranges: {},
      policy: {
        eMode: 0,
        eRandomMode: 0,
        wAvoidRepeatCount: 1,
        bResetPlayListAtEachPlay: 1,
        bIsGlobal: 1,
        bIsContinuous: 0,
        _bIsUsingWeight: 0,
        u16MaxNumInstance: 0,
        bKillNewest: 0,
        sLoopCount: 1,
        sLoopModMin: 0,
        sLoopModMax: 0,
        eTransitionMode: 0,
        eVirtualQueueBehavior: 1,
        eBelowThresholdBehavior: 0,
      },
      transition: {
        fTransitionTime: 1000.0,
        fTransitionTimeModMin: 0.0,
        fTransitionTimeModMax: 0.0,
      },
      playlist: [
        {
          id: 706310825,
          weight: 50000,
        },
      ],
    },
  ],
  sounds: [
    {
      id: 706310825,
      parentId: 491713706,
      busId: 0,
      properties: {},
      ranges: {},
      clip: {
        id: 795142737,
        url: 'assets/audio/ahri-recall/795142737.wav',
        sha256: '8cd4d6bd91380d996e74e7134bb3923628c8547d94638e033fb5076fdef04c71',
        pcmSha256: '18774825266b75d69ecd7dbc02f015b747a7b01b9b374d74ddb42b92a607e5fe',
        frames: 425925,
        sampleRate: 44100,
        channels: 1,
        durationSeconds: 9.658163265306122,
        peak: 1.0489227771759033,
      },
    },
  ],
  mixers: [
    {
      id: 693628260,
      parentId: 0,
      busId: 2232828494,
      properties: {
        Priority: 55.0,
        AttenuationID: 687014649.0,
      },
      ranges: {},
    },
  ],
  attenuation: [
    {
      distance: 0.0,
      storedValue: 0.0,
      interpolation: 9,
    },
    {
      distance: 1350.0,
      storedValue: 0.0,
      interpolation: 4,
    },
    {
      distance: 2412.0,
      storedValue: -1.0,
      interpolation: 4,
    },
  ],
  unresolvedGlobalBus: 2232828494,
} as const;
