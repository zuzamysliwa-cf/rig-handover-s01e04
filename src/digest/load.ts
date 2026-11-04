import type { RigConfig } from '../config.js';
import { readNight } from './read.js';
import type { Night } from './types.js';

// Shared by the page and the JSON route so they never disagree. null: no file for that night.
export function loadNight(config: RigConfig, night: string): Night | null {
  return readNight(config.runsDir, night);
}
