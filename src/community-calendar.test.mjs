import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { communityCalendar } from "./community-calendar.mjs";

const meeting = {
  id: "meeting",
  title: "JuliaBayes meeting",
  start: "2026-11-25T12:00:00Z",
  end: "2026-11-25T13:00:00Z",
  updated: "2026-11-23T11:00:00Z",
};

test("keeps past events and publishes cancellations with the same ID", () => {
  const feed = communityCalendar([
    { ...meeting, id: "completed", start: "2026-11-23T10:00:00Z", end: "2026-11-23T12:00:00Z" },
    { ...meeting, id: "ongoing", start: "2026-11-23T11:00:00Z", end: "2026-11-23T13:00:00Z" },
    { ...meeting, sequence: 1, cancelled: true },
  ]);
  assert.deepEqual([...feed.matchAll(/^UID:(.+)\r$/gm)].map(([, uid]) => uid), [
    "completed@juliabayes.org", "ongoing@juliabayes.org", "meeting@juliabayes.org",
  ]);
  assert.match(feed, /UID:meeting@juliabayes\.org[\s\S]+SEQUENCE:1\r\nSTATUS:CANCELLED/);
});

test("supports date-only events and keeps a valid empty calendar", () => {
  const event = { ...meeting, start: "2026-11-18", end: undefined };
  assert.match(communityCalendar([event]), /DTSTART;VALUE=DATE:20261118/);
  const empty = communityCalendar([]);
  assert.doesNotMatch(empty, /BEGIN:VEVENT/);
  assert.match(empty, /BEGIN:VTIMEZONE\r\nTZID:Etc\/UTC/);
  assert.match(empty, /SOURCE;VALUE=URI:https:\/\/juliabayes\.org\/events\.ics/);
});

test("escapes event text and folds UTF-8 lines without changing the title", () => {
  const title = "Bayes, Julia; " + "é".repeat(80) + "\nTalk";
  const feed = communityCalendar([{ ...meeting, title }]);
  assert.ok(feed.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  assert.ok(feed.replace(/\r\n /g, "").includes("SUMMARY:Bayes\\, Julia\\; " + "é".repeat(80) + "\\nTalk"));
});

test("publishes the meeting link as the location and rejects plain HTTP links", () => {
  const feed = communityCalendar([{ ...meeting, "meeting-url": "https://example.org/join?id=1,2" }]);
  assert.match(feed, /LOCATION:https:\/\/example\.org\/join\?id=1\\,2\r\n/);
  assert.throws(() => communityCalendar([{ ...meeting, "meeting-url": "http://example.org/" }]), /HTTPS/);
  assert.throws(() => communityCalendar([{ ...meeting, description: 42 }]), /text/);
});

test("reads the YAML events file", () => {
  const events = parse(readFileSync(new URL("../events.yml", import.meta.url), "utf8"));
  assert.ok(Array.isArray(events));
  assert.match(communityCalendar(events), /BEGIN:VEVENT/);
});
