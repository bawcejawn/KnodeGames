// Shared Game Kit: alerts (RECORDER §6.5). GitHub Actions turns ::error:: lines into annotations; a failed recorder
// step fails the run AFTER publishing, so the owner gets an email.
export type Alerts = { errors: string[]; warnings: string[]; notes: string[] };
export const newAlerts = (): Alerts => ({ errors: [], warnings: [], notes: [] });

export function print(a: Alerts, slug: string, out: (s: string) => void = console.log) {
  for (const e of a.errors) out(`::error::${slug}: ${e}`);
  for (const w of a.warnings) out(`::warning::${slug}: ${w}`);
  for (const n of a.notes) out(`  ${n}`);
}

/** A "results due" warning once fewer than this many hours are left in the vault's window. */
export const DUE_WARN_HOURS = 24;
