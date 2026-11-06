// Generated unflattened source graph. Finite death/respawn source graph. Zero instance declarations stay raw; native dispatch/inheritance remain unverified.
export const AHRI_LIFECYCLE_AUDIO = {
  readingSha256: 'a5444d54814a9f27af2849d79767d5d7d5b85e9b47bb54c701ac5af8b5eb175c',
  events: [
    {
      role: 'death',
      id: 1977556474,
      declaredName: 'Play_sfx_Ahri_Death3D_cast',
      actions: [
        {
          id: 624029042,
          type: 'CAkActionPlay',
          target: 889858872,
          properties: {},
          fadeCurve: 4,
          actionType: 1027,
        },
      ],
    },
    {
      role: 'stopDeath',
      id: 2947637328,
      declaredName: 'Stop_sfx_Ahri_Death3D_cast',
      actions: [
        {
          id: 1021566158,
          type: 'CAkActionStop',
          target: 889858872,
          properties: {
            TransitionTime: 5000.0,
          },
          fadeCurve: 4,
          actionType: 259,
        },
      ],
    },
    {
      role: 'respawn',
      id: 684493285,
      declaredName: 'Play_sfx_Ahri_Respawn3D_buffactivate',
      actions: [
        {
          id: 557818604,
          type: 'CAkActionPlay',
          target: 451024335,
          properties: {},
          fadeCurve: 4,
          actionType: 1027,
        },
      ],
    },
  ],
  containers: [
    {
      id: 451024335,
      parentId: 693628260,
      busId: 0,
      properties: {
        MakeUpGain: -9.0,
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
          id: 1073301232,
          weight: 50000,
        },
      ],
    },
    {
      id: 889858872,
      parentId: 693628260,
      busId: 0,
      properties: {
        MakeUpGain: -12.0,
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
          id: 265674343,
          weight: 50000,
        },
      ],
    },
  ],
  sounds: [
    {
      id: 265674343,
      parentId: 889858872,
      busId: 0,
      properties: {
        Priority: 55.0,
      },
      ranges: {},
      clip: {
        id: 357887993,
        url: 'assets/audio/ahri-lifecycle/357887993.wav',
        sha256: '4bd6dd8a07901b4a27ae6fa05c809ffbae484fcab58626d322260970230acc67',
        pcmSha256: '8982901296ff57222f185c2de62c35b96a0d70fb1026413cc977ee7ef6db2bc1',
        frames: 171089,
        sampleRate: 44100,
        channels: 1,
        durationSeconds: 3.8795691609977325,
        peak: 0.8222296237945557,
      },
    },
    {
      id: 1073301232,
      parentId: 451024335,
      busId: 0,
      properties: {},
      ranges: {},
      clip: {
        id: 1057065243,
        url: 'assets/audio/ahri-lifecycle/1057065243.wav',
        sha256: '78894a76a4d93cd4c8e202779b779607c87449097340a6be44bd43ef838c2275',
        pcmSha256: 'ff754cd41efc68cc45e7bc4c92f1b8eec5a5b765e90d688e561ae8e865cf039a',
        frames: 215394,
        sampleRate: 44100,
        channels: 1,
        durationSeconds: 4.8842176870748295,
        peak: 0.9017490744590759,
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
