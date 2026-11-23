import assert from "node:assert/strict";
import test from "node:test";
import { communityCalendar } from "./community-calendar.mjs";

const now = Date.parse("2026-11-23T12:00:00Z");
const meeting = {
  id: "meeting",
  title: "JuliaBayes meeting",
  start: "2026-11-25T12:00:00Z",
  end: "2026-11-25T13:00:00Z",
  updated: "2026-11-23T11:00:00Z",
};

test("omits completed events and keeps ongoing events and upcoming cancellations", () => {
  const feed = communityCalendar([
    { ...meeting, id: "completed", start: "2026-11-23T10:00:00Z", end: "2026-11-23T12:00:00Z" },
    { ...meeting, id: "ongoing", start: "2026-11-23T11:00:00Z", end: "2026-11-23T13:00:00Z" },
    { ...meeting, sequence: 1, cancelled: true },
  ], now);
  assert.deepEqual([...feed.matchAll(/^UID:(.+)\r$/gm)].map(([, uid]) => uid), [
    "ongoing@juliabayes.org", "meeting@juliabayes.org",
  ]);
  assert.match(feed, /UID:meeting@juliabayes\.org[\s\S]+SEQUENCE:1\r\nSTATUS:CANCELLED/);
});

test("drops a date-only event at the end of its day and keeps the empty feed", () => {
  const event = { ...meeting, start: "2026-11-23", end: undefined };
  assert.match(communityCalendar([event], now), /DTSTART;VALUE=DATE:20261123/);
  const nextDay = communityCalendar([event], Date.parse("2026-11-24T00:00:00Z"));
  assert.doesNotMatch(nextDay, /BEGIN:VEVENT/);
  assert.match(nextDay, /BEGIN:VTIMEZONE\r\nTZID:Etc\/UTC/);
  assert.match(nextDay, /SOURCE;VALUE=URI:https:\/\/juliabayes\.org\/events\.ics/);
});

test("escapes event text and folds UTF-8 lines without changing the title", () => {
  const title = "Bayes, Julia; " + "é".repeat(80) + "\nTalk";
  const feed = communityCalendar([{ ...meeting, title }], now);
  assert.ok(feed.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  assert.ok(feed.replace(/\r\n /g, "").includes("SUMMARY:Bayes\\, Julia\\; " + "é".repeat(80) + "\\nTalk"));
});
