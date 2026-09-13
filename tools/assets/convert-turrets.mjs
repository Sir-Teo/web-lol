import { convertStructureModels } from './convert-structure-models.mjs';
await convertStructureModels({
  family: 'turret',
  variants: ['blue', 'red'].map((team) => ({ key: team, name: `${team}-turret` })),
  copyright: 'Tower artwork and animation © Riot Games. Reference content.',
  generator: 'web-lol tower converter 0.1; lol2gltf + glTF Transform',
});
