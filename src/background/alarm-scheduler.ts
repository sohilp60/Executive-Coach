/**
 * Alarm Scheduler
 * Creates and manages the three daily coaching alarms.
 * Each alarm fires once at the target time, then repeats every 24 hours.
 */

/** Alarm names used throughout the extension */
export const ALARM_NAMES = {
  MORNING_TRIAGE: 'MORNING_TRIAGE',
  MIDDAY_DRIFT_CHECK: 'MIDDAY_DRIFT_CHECK',
  EOD_FOLLOWUP_SWEEP: 'EOD_FOLLOWUP_SWEEP',
} as const;

export type AlarmName = (typeof ALARM_NAMES)[keyof typeof ALARM_NAMES];

/** Daily schedule: alarm name → { hour, minute } in local time */
const DAILY_SCHEDULE: Record<AlarmName, { hour: number; minute: number }> = {
  [ALARM_NAMES.MORNING_TRIAGE]: { hour: 9, minute: 0 },
  [ALARM_NAMES.MIDDAY_DRIFT_CHECK]: { hour: 13, minute: 0 },
  [ALARM_NAMES.EOD_FOLLOWUP_SWEEP]: { hour: 17, minute: 0 },
};

/**
 * Calculate the next occurrence of a given hour:minute in local time.
 * If the target time has already passed today, returns tomorrow's timestamp.
 */
export function getNextAlarmTime(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0,
    0
  );

  // If the target time already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}

/**
 * Create (or recreate) the three daily coaching alarms.
 * Safe to call multiple times — chrome.alarms.create overwrites existing alarms
 * with the same name.
 */
export function setupDailyAlarms(): void {
  for (const [name, { hour, minute }] of Object.entries(DAILY_SCHEDULE)) {
    chrome.alarms.create(name, {
      when: getNextAlarmTime(hour, minute),
      periodInMinutes: 24 * 60, // repeat every 24 hours
    });
  }
}
