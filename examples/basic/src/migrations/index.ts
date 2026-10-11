import * as migration_20261010_135110_initial from './20261010_135110_initial';
import * as migration_20261010_153647_payload_3_90 from './20261010_153647_payload_3_90';
import * as migration_20261011_235807_users_role from './20261011_235807_users_role';

export const migrations = [
  {
    up: migration_20261010_135110_initial.up,
    down: migration_20261010_135110_initial.down,
    name: '20261010_135110_initial',
  },
  {
    up: migration_20261010_153647_payload_3_90.up,
    down: migration_20261010_153647_payload_3_90.down,
    name: '20261010_153647_payload_3_90',
  },
  {
    up: migration_20261011_235807_users_role.up,
    down: migration_20261011_235807_users_role.down,
    name: '20261011_235807_users_role'
  },
];
