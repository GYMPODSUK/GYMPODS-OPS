// src/lib/schedule.js
// Single source of truth for "what is on today".
//
// Before this existed, three screens each worked it out their own way and
// disagreed: the Network card counted every task on every shift on the rota,
// while the task drill-down correctly counted only shifts running today. That
// is why the headline tally never matched the drill-down.
//
// Anything that counts, lists or scores today's tasks must use these helpers.

// Postgres stores shift_definitions.days_of_week as short lowercase keys.
// Index matches JavaScript's Date.getDay() (0 = Sunday).
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const dayKey = (date = new Date()) => DAY_KEYS[date.getDay()]

/**
 * Does this shift run on the given day?
 * An empty or missing days_of_week means "every day".
 * Pass a shift_definitions row (needs days_of_week).
 */
export function shiftRunsOn(shift, date = new Date()) {
  const days = shift?.days_of_week
  if (!days || days.length === 0) return true
  return days.includes(dayKey(date))
}

/** Filter a list of shift_definitions rows down to the ones running today. */
export function shiftsRunningOn(shifts, date = new Date()) {
  return (shifts || []).filter(s => shiftRunsOn(s, date))
}

/** Local YYYY-MM-DD — matches the `date` column on task_completions. */
export function dateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
