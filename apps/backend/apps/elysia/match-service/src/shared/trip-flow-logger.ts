/**
 * Trip Flow File Logger
 * 
 * Writes human-readable, step-by-step trip lifecycle logs to a file.
 * Each trip gets a clear timeline showing every state transition.
 * 
 * Log file: match-service/logs/trip-flow.log
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(THIS_DIR, '..', '..', 'logs');
const LOG_FILE = join(LOG_DIR, 'trip-flow.log');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}
console.log(`[TripFlowLogger] Writing to: ${LOG_FILE}`);

type FlowStep =
  | 'TRIP_REQUESTED'
  | 'MATCH_LOOP_START'
  | 'MATCH_LOOP_SKIP_DUPLICATE'
  | 'DRIVER_SEARCH_START'
  | 'DRIVER_SEARCH_RING'
  | 'DRIVER_SEARCH_CANDIDATES'
  | 'DRIVER_SEARCH_NO_CANDIDATES'
  | 'DRIVER_SEARCH_RETRY_WAIT'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_RESPONSE_POLL'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_REJECTED'
  | 'DRIVER_TIMEOUT'
  | 'TRIP_MATCHED'
  | 'TRIP_COMPLETED'
  | 'TRIP_NO_MATCH'
  | 'TRIP_CANCELLED'
  | 'SEARCH_DEADLINE_HIT'
  | 'DRIVER_REGISTERED'
  | 'DRIVER_UNREGISTERED'
  | 'DRIVER_H3_CELL_CLEANUP'
  | 'MATCH_LOOP_EXIT'
  | 'REDIS_KEY_SET'
  | 'REDIS_KEY_DEL'
  | 'NATS_PUBLISH'
  | 'NEARBY_DRIVERS_LOOKUP'
  | 'ERROR';

interface FlowLogEntry {
  step: FlowStep;
  tripId?: string;
  driverId?: string;
  detail?: string;
  data?: Record<string, unknown>;
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

export function tripLog(entry: FlowLogEntry): void {
  const ts = formatTimestamp();
  const step = pad(entry.step, 30);
  const trip = entry.tripId ? entry.tripId.substring(0, 8) : '--------';
  const driver = entry.driverId ? entry.driverId.substring(0, 8) : '--------';
  const detail = entry.detail || '';
  const dataStr = entry.data ? ' | ' + JSON.stringify(entry.data) : '';

  const line = `[${ts}] ${step} trip=${trip} driver=${driver} ${detail}${dataStr}\n`;

  // Write to file
  try {
    appendFileSync(LOG_FILE, line);
  } catch {
    // Fallback to console if file write fails
  }

  // Also log to console for immediate visibility
  console.log(`[FLOW] ${line.trim()}`);
}

export function tripLogSeparator(label?: string): void {
  const sep = label
    ? `\n${'═'.repeat(20)} ${label} ${'═'.repeat(60 - label.length)}\n`
    : `${'─'.repeat(80)}\n`;
  try {
    appendFileSync(LOG_FILE, sep);
  } catch { }
}

export function tripLogDump(title: string, obj: unknown): void {
  const ts = formatTimestamp();
  const header = `[${ts}] DUMP: ${title}\n`;
  const body = JSON.stringify(obj, null, 2)
    .split('\n')
    .map(l => `  ${l}`)
    .join('\n') + '\n';
  try {
    appendFileSync(LOG_FILE, header + body);
  } catch { }
}
