/**
 * Event window end (inclusive) for "upcoming" display: end of the last calendar
 * day of the event (local time). After that instant, the talk is past.
 */
export function getTalkWindowEnd(eventDate: Date, endDate?: Date): Date {
  const last = endDate ?? eventDate;
  const d = new Date(last);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isTalkUpcomingAt(now: Date, eventDate: Date, endDate?: Date): boolean {
  return now <= getTalkWindowEnd(eventDate, endDate);
}

export function getEventCalendarYear(d: Date): number {
  return d.getFullYear();
}
