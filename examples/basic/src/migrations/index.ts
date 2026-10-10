import * as migration_20261010_135110_initial from './20261010_135110_initial';
import * as migration_20261010_153647_payload_3_90 from './20261010_153647_payload_3_90';

export const migrations = [
  {
    up: migration_20261010_135110_initial.up,
    down: migration_20261010_135110_initial.down,
    name: '20261010_135110_initial',
  },
  {
    up: migration_20261010_153647_payload_3_90.up,
    down: migration_20261010_153647_payload_3_90.down,
    name: '20261010_153647_payload_3_90'
  },
];
