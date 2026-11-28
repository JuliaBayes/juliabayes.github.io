<%
// The landing page's next-event box. It shows the first event in events.yml
// that has not ended, and nothing if no such event exists or the data is bad.
// The daily publish build refreshes it. The inline script removes the box
// when the event ends between builds. In Quarto's templates, the output tag
// with a dash escapes HTML and the one with an equals sign does not.
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const day = 24 * 60 * 60 * 1000;
// A date-only end is exclusive. A date-only event without an end lasts a day.
const ends = (event) => event.end !== undefined ? Date.parse(event.end)
  : Date.parse(event.start) + (isDate(event.start) ? day : 0);

// The build and the page script share this function, so the UTC time and
// the reader's local time read alike. It joins the date parts itself,
// because Quarto and browsers ship different punctuation for en-GB dates.
// Quarto's template engine also expands template literals, so it uses
// concatenation.
function eventTime(start, end, timeZone) {
  const parts = (date, options) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: timeZone, ...options,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const dateText = (date) => {
    const p = parts(date, { weekday: "short", day: "numeric", month: "short" });
    return p.weekday + " " + p.day + " " + p.month;
  };
  const clockText = (date) => {
    const p = parts(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    return p.hour + ":" + p.minute;
  };
  const from = new Date(start);
  const to = end ? new Date(end) : null;
  let text = dateText(from) + ", " + clockText(from);
  if (to) {
    text += dateText(to) === dateText(from) ? "–" + clockText(to)
      : " – " + dateText(to) + ", " + clockText(to);
  }
  // Intl names the offset from GMT, and some runtimes write a zero offset as
  // GMT+0. The site names the offset from UTC.
  const offset = parts(from, { timeZoneName: "shortOffset" }).timeZoneName.replace("GMT", "UTC");
  return text + " " + (/^UTC(?:[+-]0+)?$/.test(offset) ? "UTC" : offset);
}

// A date-only event shows its first and last day. The end date is exclusive.
function eventDays(start, end) {
  const dateText = (value) => eventTime(value, null, "UTC").split(",")[0];
  const last = end ? new Date(Date.parse(end) - day).toISOString().slice(0, 10) : start;
  return last === start ? dateText(start) : dateText(start) + " – " + dateText(last);
}

const https = (value) => typeof value === "string" && value.startsWith("https://") ? value : null;

let next = null;
try {
  const now = Date.now();
  const event = items
    .filter((event) => typeof event.start === "string" && typeof event.title === "string" && !event.cancelled)
    .filter((event) => Number.isFinite(Date.parse(event.start)) && ends(event) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (event) {
    next = {
      title: event.title,
      start: event.start,
      end: typeof event.end === "string" ? event.end : "",
      until: new Date(ends(event)).toISOString(),
      when: isDate(event.start) ? eventDays(event.start, event.end) : eventTime(event.start, event.end, "UTC"),
      description: typeof event.description === "string" ? event.description : null,
      url: https(event.url),
      meeting: https(event["meeting-url"]),
    };
  }
} catch {
  next = null;
}
%>
<% if (next) { %>

```{=html}
<section class="accent-card accent-blue landing-event" data-until="<%- next.until %>">
  <div class="landing-card-header">
    <h2>Next event</h2>
  </div>
  <div class="landing-panel landing-event-panel">
    <h3><%- next.title %></h3>
    <p class="landing-event-when">
      <i class="bi bi-clock" aria-hidden="true"></i>
      <time datetime="<%- next.start %>" data-end="<%- next.end %>"><%- next.when %></time>
    </p>
<% if (next.description) { %>
    <p><%- next.description %></p>
<% } %>
<% if (next.meeting || next.url) { %>
    <p class="landing-event-links">
<% if (next.meeting) { %>
      <a class="btn accent-button accent-blue" href="<%- next.meeting %>"><i class="bi bi-camera-video" aria-hidden="true"></i> Join the meeting</a>
<% } %>
<% if (next.url) { %>
      <a href="<%- next.url %>">Details →</a>
<% } %>
    </p>
<% } %>
  </div>
</section>
<script>
(() => {
  const box = document.currentScript.previousElementSibling;
  try {
    if (Date.parse(box.dataset.until) <= Date.now()) return box.remove();
    // A timed event also shows the reader's local time, unless it is UTC.
    // The local date shows only if it differs from the UTC date.
    const time = box.querySelector(".landing-event-when time");
    if (!time.dateTime.includes("T")) return;
    const eventTime = <%= eventTime.toString() %>;
    const local = eventTime(time.dateTime, time.dataset.end, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (local.endsWith(" UTC")) return;
    const date = (text) => text.split(", ")[0];
    const note = document.createElement("span");
    note.textContent = "(" + (date(local) === date(time.textContent) ? local.slice(date(local).length + 2) : local) + ")";
    time.after(" ", note);
  } catch {
    // The box from the build stays.
  }
})();
</script>
```

<% } %>
