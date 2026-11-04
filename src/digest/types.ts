// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing at the edge.
export type RunLine = {
  at: string; // ISO 8601 with the offset from the log; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as '—'
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one; null renders as '—'
  firstAt: string; // as written in the log
  lastAt: string; // as written in the log
};

// What a night reads into. `rows` sorted by job. `badLines` counts non-empty lines that did
// not parse into a RunLine; they are counted, never thrown.
export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[];
  badLines: number;
};

// Reads runsDir/<night>.jsonl. Returns null when the file does not exist (the routes answer
// 404); an empty file gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
