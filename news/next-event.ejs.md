<%
// The landing page's next-event line. It shows the first event in events.yml
// that has not ended, and nothing if no such event exists or the data is bad.
// The daily publish build refreshes it. The inline script removes the line
// when the event ends between builds.
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const day = 24 * 60 * 60 * 1000;
// A date-only end is exclusive. A date-only event without an end lasts a day.
const ends = (event) => event.end !== undefined ? Date.parse(event.end)
  : Date.parse(event.start) + (isDate(event.start) ? day : 0);
const when = (value) => new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short",
  ...(isDate(value) ? {} : { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
  timeZone: "UTC",
}).format(new Date(value));

let next = null;
try {
  const now = Date.now();
  next = items
    .filter((event) => typeof event.start === "string" && event.title && !event.cancelled)
    .filter((event) => Number.isFinite(Date.parse(event.start)) && ends(event) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] ?? null;
  if (next) next = { ...next, end: new Date(ends(next)).toISOString(), label: when(next.start) };
  if (next?.url && !next.url.startsWith("https://")) next.url = null;
} catch {
  next = null;
}
%>
<% if (next) { %>

```{=html}
<p class="landing-next-event" data-end="<%= next.end %>">
  Next: <%= next.title %>,
  <% if (next.url) { %><a href="<%= next.url %>"><% } %><time datetime="<%= next.start %>"><%= next.label %></time><% if (next.url) { %></a><% } %>
</p>
<script>
(() => {
  const line = document.currentScript.previousElementSibling;
  try {
    if (Date.parse(line.dataset.end) <= Date.now()) return line.remove();
    // A timed event also shows the reader's local time, unless the reader is
    // on UTC. The local date shows only if it differs from the UTC date.
    const time = line.querySelector("time");
    if (!time.dateTime.includes("T")) return;
    const start = new Date(time.dateTime);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const format = (options) => new Intl.DateTimeFormat("en-GB", options).format(start);
    const day = { weekday: "short", day: "numeric", month: "short" };
    if (format({ ...day, hour: "2-digit", minute: "2-digit", timeZone: zone }) ===
      format({ ...day, hour: "2-digit", minute: "2-digit", timeZone: "UTC" })) return;
    const sameDay = format({ ...day, timeZone: zone }) === format({ ...day, timeZone: "UTC" });
    const local = format({
      ...(sameDay ? {} : day), hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone: zone,
    });
    const note = document.createElement("span");
    // Quarto's template engine also expands template literals, so the script
    // uses concatenation.
    note.textContent = "(" + local + ")";
    time.after(" ", note);
  } catch {
    // The line from the build stays.
  }
})();
</script>
```

<% } %>
