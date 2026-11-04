import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted, and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates retries and keeps the last error', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps fail and its error', () => {
    const row = night?.rows.find((r) => r.job === 'notes/backup');
    expect(row?.lastStatus).toBe('fail');
    expect(row?.lastError).toBe('quota exceeded');
  });

  it('keeps a null owner', () => {
    const row = night?.rows.find((r) => r.job === 'digest/render');
    expect(row).toBeDefined();
    expect(row?.owner).toBeNull();
    expect(row?.lastError).toBeNull();
  });

  it('keeps times as written, offset included', () => {
    const row = night?.rows.find((r) => r.job === 'rig/rotate-logs');
    expect(row?.firstAt).toBe('2026-10-28T23:00:02+01:00');
    expect(row?.lastAt).toBe('2026-10-28T23:00:02+01:00');
  });
});

describe('readNight on a temp runs dir', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns null for a malformed night (no path tricks)', () => {
    writeFileSync(join(dir, 'x.jsonl'), '');
    expect(readNight(dir, 'x')).toBeNull();
    expect(readNight(dir, '../2026-01-01')).toBeNull();
  });

  it('reads an empty file as no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('skips blank and whitespace-only lines without counting them', () => {
    const line = '{"at":"2026-01-03T01:00:00+02:00","job":"a","status":"ok","owner":"x"}';
    writeFileSync(join(dir, '2026-01-03.jsonl'), `\n${line}\r\n   \r\n\t\n${line}\n\n`);
    const night = readNight(dir, '2026-01-03');
    expect(night?.badLines).toBe(0);
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.runs).toBe(2);
  });

  it('counts lines that are not RunLines as bad, never throws', () => {
    const lines = [
      'not json',
      '[]',
      'null',
      '{"at":"t","job":"a","status":"maybe","owner":"x"}',
      '{"at":"t","job":"a","status":"ok"}',
      '{"at":"t","job":"a","status":"ok","owner":3}',
      '{"at":"t","job":"a","status":"ok","owner":"x","error":42}',
      '{"at":1,"job":"a","status":"ok","owner":"x"}',
      '{"at":"t","job":"b","status":"ok","owner":null}',
    ];
    writeFileSync(join(dir, '2026-01-04.jsonl'), lines.join('\n'));
    const night = readNight(dir, '2026-01-04');
    expect(night?.badLines).toBe(8);
    expect(night?.rows.map((r) => r.job)).toEqual(['b']);
  });

  it('takes owner and status from the last line, error from the last line that had one', () => {
    const lines = [
      '{"at":"2026-01-05T01:00:00-05:00","job":"j","status":"fail","owner":"x","error":"first"}',
      '{"at":"2026-01-05T02:00:00-05:00","job":"j","status":"retry","owner":"y","error":"second"}',
      '{"at":"2026-01-05T03:00:00-05:00","job":"j","status":"ok","owner":null}',
    ];
    writeFileSync(join(dir, '2026-01-05.jsonl'), lines.join('\n'));
    expect(readNight(dir, '2026-01-05')?.rows).toEqual([
      {
        job: 'j',
        owner: null,
        runs: 3,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'second',
        firstAt: '2026-01-05T01:00:00-05:00',
        lastAt: '2026-01-05T03:00:00-05:00',
      },
    ]);
  });
});
