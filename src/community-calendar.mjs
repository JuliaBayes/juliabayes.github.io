import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const site = "https://juliabayes.org";
const day = 24 * 60 * 60 * 1000;

function dateValue(value) {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(value);
  const iso = Number.isFinite(+date) ? date.toISOString() : "";
  const expected = allDay ? iso.slice(0, 10) : iso.replace(".000Z", "Z");
  if (!iso || value !== expected) throw new Error(`Use a date or a UTC timestamp in seconds: ${value}`);
  return { value: value.replace(/[-:]/g, ""), time: +date, allDay };
}

function text(value) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[;,]/g, "\\$&");
}

function fold(line) {
  let output = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) {
      output += "\r\n ";
      bytes = 1;
    }
    output += character;
    bytes += size;
  }
  return output;
}

export function communityCalendar(events, now = Date.now()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JuliaBayes//Community Calendar//EN",
    "CALSCALE:GREGORIAN",
    "NAME:JuliaBayes community calendar",
    "X-WR-CALNAME:JuliaBayes community calendar",
    `SOURCE;VALUE=URI:${site}/events.ics`,
  ];
  const ids = new Set();
  for (const event of events) {
    const { id, title, start, end, updated, sequence = 0, cancelled = false, description, url } = event;
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id) || ids.has(id)) {
      throw new Error(`Invalid or duplicate event ID: ${id}`);
    }
    ids.add(id);
    const from = dateValue(start);
    const to = end === undefined ? null : dateValue(end);
    if (to && (to.time <= from.time || to.allDay !== from.allDay)) {
      throw new Error(`End must follow start and use the same date format: ${id}`);
    }
    if ((to?.time ?? (from.time + (from.allDay ? day : 0))) <= now) continue;

    const stamp = dateValue(updated);
    if (stamp.allDay || !Number.isSafeInteger(sequence) || sequence < 0 || !title?.trim() ||
      typeof cancelled !== "boolean") {
      throw new Error(`Invalid title, update time, sequence or cancellation flag: ${id}`);
    }
    const dateType = from.allDay ? ";VALUE=DATE" : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${id}@juliabayes.org`,
      `DTSTAMP:${stamp.value}`,
      `DTSTART${dateType}:${from.value}`,
      `SEQUENCE:${sequence}`,
      `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
      `SUMMARY:${text(title)}`,
    );
    if (to) lines.push(`DTEND${dateType}:${to.value}`);
    if (description) lines.push(`DESCRIPTION:${text(description)}`);
    if (url) {
      const link = new URL(url);
      if (link.protocol !== "https:") throw new Error(`Event URL must use HTTPS: ${id}`);
      lines.push(`URL:${link.href}`);
    }
    lines.push("END:VEVENT");
  }
  if (!lines.includes("BEGIN:VEVENT")) {
    // iCalendar requires a component even when no events are scheduled.
    lines.push(
      "BEGIN:VTIMEZONE", "TZID:Etc/UTC", "BEGIN:STANDARD",
      "DTSTART:19700101T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0000",
      "END:STANDARD", "END:VTIMEZONE",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const events = JSON.parse(readFileSync(new URL("../events.json", import.meta.url), "utf8"));
  writeFileSync(new URL("../events.ics", import.meta.url), communityCalendar(events));
}
