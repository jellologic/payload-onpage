import * as migration_20261010_135110_initial from './20261010_135110_initial';

export const migrations = [
  {
    up: migration_20261010_135110_initial.up,
    down: migration_20261010_135110_initial.down,
    name: '20261010_135110_initial'
  },
];
