export function formatEventRange(eventDate: Date, endDate?: Date) {
  if (endDate) {
    const a = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(eventDate);
    const b = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(endDate);
    if (a === b) return a;
    return `${a} – ${b}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(eventDate);
}

export function formatCalendarDay(d: Date) {
  return {
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(d).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(d),
  };
}
