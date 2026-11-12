// Types for bot/alert-summary.mjs (plain JavaScript, so the watchdog and workflow steps can run it without tsx).
export type AlertRow = { section: number; title: string; keys: string[]; cols: Record<string, string> };
export const ALERTS_FILE: string;
export function loadAlertRows(md: string): AlertRow[];
export function matchAlert(line: string, rows: AlertRow[]): AlertRow | null;
export function deadlines(line: string): string[];
export function renderSummary(o: { workflow?: string; lines?: string[]; rows?: AlertRow[]; section?: number }): string;
export function writeSummary(o: { workflow?: string; lines?: string[]; section?: number; alertsFile?: string; env?: Record<string, string | undefined>; print?: (s: string) => void }): string;
