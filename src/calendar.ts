// Real Google Calendar integration via prefilled event-creation URLs.
// No OAuth needed: the link opens a draft event on the user's real calendar
// with title/time/location/details filled in — one click on Save adds it.

function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

export interface CalEvent {
  title: string;
  start: Date;
  durationMin: number;
  location?: string;
  details?: string;
}

export function gcalUrl(ev: CalEvent): string {
  const end = new Date(ev.start.getTime() + ev.durationMin * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmtLocal(ev.start)}/${fmtLocal(end)}`,
  });
  if (ev.location) params.set("location", ev.location);
  if (ev.details) params.set("details", ev.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Real wall-clock time N minutes from now, rounded up to the next 5 minutes. */
export function inMinutes(min: number): Date {
  const t = Date.now() + min * 60_000;
  const step = 5 * 60_000;
  return new Date(Math.ceil(t / step) * step);
}

export function fmtRange(start: Date, durationMin: number): string {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const f = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${f(start)}\u{2013}${f(end)}`;
}
