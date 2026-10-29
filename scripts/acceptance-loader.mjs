// Entry point for --import: registers scripts/loader-hooks.mjs, then lets
// Node load the acceptance repo-steps .mts file with type stripping.
import { register } from 'node:module';
register(new URL('./loader-hooks.mjs', import.meta.url));
