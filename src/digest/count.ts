import type { Night } from './types.js';

// Counts shown beside a night on the status board. DigestRow keeps no per-status line counts,
// so: retry = retry lines (sum of retries); ok / fail = jobs whose last status is ok / fail.
export type NightCounts = { ok: number; retry: number; fail: number };

export function countNight(night: Night): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of night.rows) {
    counts.retry += row.retries;
    if (row.lastStatus === 'ok') counts.ok += 1;
    else if (row.lastStatus === 'fail') counts.fail += 1;
  }
  return counts;
}
