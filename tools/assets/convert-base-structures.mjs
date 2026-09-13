import { convertStructureModels } from './convert-structure-models.mjs';
await convertStructureModels({
  family: 'base-structure',
  variants: ['blue', 'red'].flatMap((team) => [
    {
      key: `${team}-nexus`,
      name: `${team}-nexus`,
      idle: 'Idle1_Base',
      destroyed: 'Death',
      animateDestruction: true,
    },
    {
      key: `${team}-inhibitor`,
      name: `${team}-inhibitor`,
      idle: 'Idle_Normal1',
      destroyed: 'Death_Base',
      animateDestruction: true,
      deadIdle: '{c3247102}',
    },
  ]),
  copyright: 'Nexus and inhibitor artwork and animation © Riot Games. Reference content.',
  generator: 'web-lol base structure converter 0.1; lol2gltf + glTF Transform',
});
