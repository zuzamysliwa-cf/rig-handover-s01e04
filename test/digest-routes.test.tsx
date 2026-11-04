import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { Night } from '../src/digest/types.js';

// Every night in this file lives in a temp dir. The repo's runs/ folder is never touched.
let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-'));
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  app = createApp(config);

  // Two jobs, notes/backup comes first in the file so the sort is actually tested.
  writeFileSync(
    join(runsDir, '2026-01-01.jsonl'),
    [
      '{"at":"2026-01-01T01:00:00+01:00","job":"notes/backup","status":"fail","owner":"rook","error":"quota exceeded"}',
      '{"at":"2026-01-01T01:10:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-01-01T01:20:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-01-01T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-01-01T01:40:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-01-03.jsonl'),
    [
      '{"at":"2026-01-03T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      '{"at":"2026-01-03T01:00:00+01:00","job":"x"',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Job names in the order the HTML table shows them.
function tableJobs(html: string): string[] {
  return [...html.matchAll(/<tr>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1] ?? '');
}

describe('GET /digest/:night (HTML)', () => {
  it('200 for a night with a file, lists each job and flags warnings', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('notes/backup');
    expect(html).toContain('class="warn"');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for this night');
  });

  it('empty night: 200 and says nothing ran', async () => {
    const res = await app.request('/digest/2026-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table>');
  });

  it('bad line: 200 and reports one unreadable line', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('lane/sync');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 for a night with a file, rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['fixtures/refresh', 'notes/backup']);
    expect(body.rows[0]?.retries).toBe(3);
    expect(body.rows[1]?.lastStatus).toBe('fail');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-09');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: '2026-01-09' });
  });

  it('empty night: 200, no rows, no bad lines', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('bad line: 200, badLines 1, the valid job is still there', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});

describe('page and JSON agree', () => {
  it('HTML table order matches JSON rows order for 2026-01-01', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const json = (await (await app.request('/api/digest/2026-01-01')).json()) as Night;
    const htmlJobs = tableJobs(html);
    expect(htmlJobs).toHaveLength(2);
    expect(htmlJobs).toEqual(json.rows.map((r) => r.job));
  });
});
