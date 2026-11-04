import type { Night } from './types.js';

// Counts shown beside a night on the status board: run-log lines by status, summed over jobs.
export type NightCounts = { ok: number; retry: number; fail: number };

export function countNight(night: Night): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of night.rows) {
    counts.retry += row.retries;
    counts.fail += row.fails;
    counts.ok += row.runs - row.retries - row.fails;
  }
  return counts;
}
