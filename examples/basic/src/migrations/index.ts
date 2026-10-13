import * as migration_20261010_135110_initial from './20261010_135110_initial';
import * as migration_20261010_153647_payload_3_90 from './20261010_153647_payload_3_90';
import * as migration_20261011_235807_users_role from './20261011_235807_users_role';
import * as migration_20261012_190626_schedule_publish from './20261012_190626_schedule_publish';
import * as migration_20261012_195410_page_comments from './20261012_195410_page_comments';
import * as migration_20261012_201359_saved_sections from './20261012_201359_saved_sections';

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
    name: '20261011_235807_users_role',
  },
  {
    up: migration_20261012_190626_schedule_publish.up,
    down: migration_20261012_190626_schedule_publish.down,
    name: '20261012_190626_schedule_publish',
  },
  {
    up: migration_20261012_195410_page_comments.up,
    down: migration_20261012_195410_page_comments.down,
    name: '20261012_195410_page_comments',
  },
  {
    up: migration_20261012_201359_saved_sections.up,
    down: migration_20261012_201359_saved_sections.down,
    name: '20261012_201359_saved_sections'
  },
];
