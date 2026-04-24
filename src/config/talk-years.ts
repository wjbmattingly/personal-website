/** Earliest year with talks in the sidebar. */
const EARLIEST = 2024;

/**
 * Years in the talks sidebar: current calendar year down to {@link EARLIEST} (inclusive),
 * generated at build time. Does not list future years.
 */
const currentYear = new Date().getFullYear();
const topYear = Math.max(EARLIEST, currentYear);

export const TALK_SIDEBAR_YEARS: number[] = Array.from(
  { length: topYear - EARLIEST + 1 },
  (_, i) => topYear - i
);
