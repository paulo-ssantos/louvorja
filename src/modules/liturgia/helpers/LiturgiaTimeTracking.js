/**
 * LiturgiaTimeTracking.js
 * Helper for recording worship service timing data.
 *
 * OWNED BY ENGINEER A — imported and called by Engineer B (LiturgiaDayView.vue).
 * All persistence is in $userdata (localStorage), day-scoped.
 *
 * API consumed by Engineer B:
 *   isEnabled()                                     -> boolean
 *   recordExecution({ dayIndex, item, mode })       -> void
 *   closeEntryForItem(dayIndex, item_id)            -> void
 *
 * API used internally by A's components (TimeBar / ReportDialog):
 *   resetDay(dayIndex)
 *   getLog(dayIndex)                                -> { session_started_at, entries }
 *   anchor(dayIndex)                                -> Date | null
 *   expectedStart(dayIndex, entryIndex)             -> Date | null
 *   computeStatus(dayIndex)                         -> { code:'late'|'early'|'ontime'|'no_plan', minutes:Number }
 *   buildReportRows(dayIndex)                       -> Array<ReportRow>
 *   toCsv(rows)                                     -> string
 *   toTsv(rows)                                     -> string
 *   getPlannedStart(dayIndex)                       -> string | null   ('HH:MM')
 *   setPlannedStart(dayIndex, value)                -> void
 */

import $userdata from '@/helpers/UserData';

// ─── constants ───────────────────────────────────────────────────────────────

const ENABLED_KEY  = 'modules.liturgia.time_tracking.enabled';
const PLANNED_START_BASE = 'modules.liturgia.time_tracking.planned_start';
const LOG_BASE = 'modules.liturgia.time_log';

// ─── helpers ─────────────────────────────────────────────────────────────────

function logKey(dayIndex) {
  return `${LOG_BASE}.${dayIndex}`;
}

function emptyLog() {
  return { session_started_at: null, entries: [] };
}

function getLog(dayIndex) {
  return $userdata.get(logKey(dayIndex), emptyLog());
}

function saveLog(dayIndex, log) {
  $userdata.set(logKey(dayIndex), log);
}

function genEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isoNow() {
  return new Date().toISOString();
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Returns true when time tracking is enabled. Default false.
 * Called by B before recordExecution — safe no-op if false.
 */
export function isEnabled() {
  return !!$userdata.get(ENABLED_KEY, false);
}

/**
 * Called by B on every slide execution (and file execution).
 * Closes any open entry for the day, then appends a new one.
 * Sets session_started_at if this is the first entry of the session.
 *
 * @param {Object} opts
 * @param {number}   opts.dayIndex
 * @param {Object}   opts.item          — the full liturgia item object
 * @param {string}   opts.mode          — 'sung'|'playback'|'none'|'audio_only_sung'|'audio_only_playback'|'file'
 */
export function recordExecution({ dayIndex, item, mode }) {
  if (!isEnabled()) return;

  const now = isoNow();
  const log = getLog(dayIndex);

  // Close the currently-open entry (if any) before opening a new one
  _closeOpenEntry(log, now);

  // Set session_started_at on first execution of the session
  if (!log.session_started_at) {
    log.session_started_at = now;
  }

  // Snapshot planned_duration from item (music/file only; categories are excluded by B)
  const planned = (typeof item.planned_duration === 'number' && item.planned_duration > 0)
    ? item.planned_duration
    : null;

  const entry = {
    entry_id: genEntryId(),
    item_id: item.id,
    display_name: item.display_name || '',
    type: item.type === 'file' ? 'file' : 'music',
    mode,
    started_at: now,
    ended_at: null,
    planned_duration: planned,
  };

  log.entries.push(entry);
  saveLog(dayIndex, log);
}

/**
 * Closes the open entry for a specific item.
 * Called by:
 *   - A's time-bar "Encerrar item" stop button
 *   - B for manual completion (item marked done)
 *
 * IMPORTANT: auto-mark on the *just-opened* entry must NOT call this
 * immediately; that guard is B's responsibility (B should not call
 * closeEntryForItem when the completion was triggered by the same
 * recordExecution that just opened it).
 */
export function closeEntryForItem(dayIndex, item_id) {
  if (!isEnabled()) return;

  const now = isoNow();
  const log = getLog(dayIndex);
  let changed = false;

  for (const entry of log.entries) {
    if (entry.item_id === item_id && entry.ended_at === null) {
      entry.ended_at = now;
      changed = true;
      break;
    }
  }

  if (changed) saveLog(dayIndex, log);
}

/**
 * Clears all recorded time entries and session_started_at for the day.
 * Planned data (planned_start, item.planned_duration) is NOT cleared.
 */
export function resetDay(dayIndex) {
  saveLog(dayIndex, emptyLog());
}

// ─── planned start ────────────────────────────────────────────────────────────

export function getPlannedStart(dayIndex) {
  return $userdata.get(`${PLANNED_START_BASE}.${dayIndex}`, null);
}

export function setPlannedStart(dayIndex, value) {
  $userdata.set(`${PLANNED_START_BASE}.${dayIndex}`, value || null);
}

// ─── analytics (used by A's components) ──────────────────────────────────────

export { getLog };

/**
 * Returns the anchor Date used to compute expected_start for each entry.
 * Anchor = planned_start of today parsed as a Date (same calendar day),
 * OR session_started_at of the log, OR null.
 *
 * @param {number} dayIndex
 * @returns {Date|null}
 */
export function anchor(dayIndex) {
  const planned = getPlannedStart(dayIndex);
  if (planned) {
    // Parse HH:MM as today's date
    const [h, m] = planned.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  const log = getLog(dayIndex);
  if (log.session_started_at) {
    return new Date(log.session_started_at);
  }
  return null;
}

/**
 * Computes the expected start time of the entry at position `entryIndex`
 * within the day's entries, based on the anchor plus cumulative planned
 * durations of preceding non-category entries.
 *
 * @param {number} dayIndex
 * @param {number} entryIndex   — index into log.entries[]
 * @returns {Date|null}
 */
export function expectedStart(dayIndex, entryIndex) {
  const anch = anchor(dayIndex);
  if (!anch) return null;

  const { entries } = getLog(dayIndex);
  let offsetMs = 0;
  for (let i = 0; i < entryIndex && i < entries.length; i++) {
    const dur = entries[i].planned_duration;
    if (typeof dur === 'number' && dur > 0) {
      offsetMs += dur * 60 * 1000;
    }
  }
  return new Date(anch.getTime() + offsetMs);
}

/**
 * Computes the overall schedule status for the day based on the most
 * recent started entry.
 *
 * @param {number} dayIndex
 * @returns {{ code: 'late'|'early'|'ontime'|'no_plan', minutes: number }}
 */
export function computeStatus(dayIndex) {
  const anch = anchor(dayIndex);
  const { entries } = getLog(dayIndex);

  if (!anch || entries.length === 0) {
    return { code: 'no_plan', minutes: 0 };
  }

  // Use the last started entry for status
  const lastIdx = entries.length - 1;
  const exp = expectedStart(dayIndex, lastIdx);
  if (!exp) return { code: 'no_plan', minutes: 0 };

  const actual = new Date(entries[lastIdx].started_at);
  const deltaMs = actual.getTime() - exp.getTime();
  const deltaSec = deltaMs / 1000;

  if (deltaSec >= 60) {
    return { code: 'late', minutes: Math.round(deltaSec / 60) };
  }
  if (deltaSec <= -60) {
    return { code: 'early', minutes: Math.round(-deltaSec / 60) };
  }
  return { code: 'ontime', minutes: 0 };
}

/**
 * Builds the rows array for the report dialog.
 * Open entries use `now` as their computed end (no mutation).
 *
 * Each row: { order, display_name, type, mode, started_at, ended_at,
 *             duration_ms, planned_duration, desvio_ms, in_progress }
 *
 * @param {number} dayIndex
 * @returns {Array}
 */
export function buildReportRows(dayIndex) {
  const { entries } = getLog(dayIndex);
  const now = new Date();

  return entries.map((e, i) => {
    const start = new Date(e.started_at);
    const end = e.ended_at ? new Date(e.ended_at) : now;
    const duration_ms = end.getTime() - start.getTime();
    const in_progress = !e.ended_at;

    const exp = expectedStart(dayIndex, i);
    let desvio_ms = null;
    if (exp) {
      desvio_ms = start.getTime() - exp.getTime();
    }

    return {
      order: i + 1,
      display_name: e.display_name,
      type: e.type,
      mode: e.mode,
      started_at: e.started_at,
      ended_at: e.ended_at,
      duration_ms,
      planned_duration: e.planned_duration,
      desvio_ms,
      in_progress,
    };
  });
}

/**
 * Formats a duration in milliseconds as "M:SS" or "Hh Mm".
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) {
    return `${min}:${String(sec).padStart(2, '0')}`;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Formats an ISO date string as "HH:MM".
 * @param {string|null} iso
 * @returns {string}
 */
export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Formats a desvio in ms as "+Nm" / "-Nm" / "~0".
 * @param {number|null} ms
 * @returns {string}
 */
export function formatDesvio(ms) {
  if (ms === null || ms === undefined) return '—';
  const min = Math.round(Math.abs(ms) / 60000);
  if (Math.abs(ms) < 60000) return '~0';
  return ms > 0 ? `+${min}m` : `-${min}m`;
}

/**
 * Converts report rows to CSV string.
 * @param {Array} rows
 * @param {Function} t  — translation function t(key)
 * @returns {string}
 */
export function toCsv(rows, t) {
  const header = [
    t('time.col_order'),
    t('time.col_item'),
    t('time.col_type'),
    t('time.col_start'),
    t('time.col_end'),
    t('time.col_duration'),
    t('time.col_planned'),
    t('time.col_desvio'),
  ];

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const dataRows = rows.map(r => [
    r.order,
    esc(r.display_name),
    esc(r.type),
    esc(formatTime(r.started_at)),
    esc(r.in_progress ? t('time.in_progress') : formatTime(r.ended_at)),
    esc(formatDuration(r.duration_ms)),
    esc(r.planned_duration != null ? `${r.planned_duration}m` : '—'),
    esc(formatDesvio(r.desvio_ms)),
  ]);

  return [header.join(','), ...dataRows.map(r => r.join(','))].join('\n');
}

/**
 * Converts report rows to TSV string (for clipboard copy).
 * @param {Array} rows
 * @param {Function} t
 * @returns {string}
 */
export function toTsv(rows, t) {
  const header = [
    t('time.col_order'),
    t('time.col_item'),
    t('time.col_type'),
    t('time.col_start'),
    t('time.col_end'),
    t('time.col_duration'),
    t('time.col_planned'),
    t('time.col_desvio'),
  ];

  const dataRows = rows.map(r => [
    r.order,
    r.display_name,
    r.type,
    formatTime(r.started_at),
    r.in_progress ? t('time.in_progress') : formatTime(r.ended_at),
    formatDuration(r.duration_ms),
    r.planned_duration != null ? `${r.planned_duration}m` : '—',
    formatDesvio(r.desvio_ms),
  ]);

  return [header.join('\t'), ...dataRows.map(r => r.join('\t'))].join('\n');
}

// ─── private ──────────────────────────────────────────────────────────────────

function _closeOpenEntry(log, now) {
  for (const entry of log.entries) {
    if (entry.ended_at === null) {
      entry.ended_at = now;
      break;
    }
  }
}
