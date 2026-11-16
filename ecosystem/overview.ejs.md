<%
// The landing page's ecosystem card: one row per package, in the order of the
// ecosystem page, at most `maxPackages` rows.
const maxPackages = 10;
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const packages = items.filter((item) => item.task !== undefined);
const releases = new Map(items
  .filter((item) => item["release-package"] !== undefined)
  .map((item) => [item["release-package"], item]));
const releaseDate = (date) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(date));

for (const pkg of packages) {
  if (!releases.has(pkg.title)) {
    throw new Error(`Add ${pkg.title} to ecosystem/releases.yml and run node src/package-releases.mjs`);
  }
}

const byOrderThenTitle = (a, b) =>
  a.order - b.order || a.title.localeCompare(b.title);
const shown = packages.sort(byOrderThenTitle).slice(0, maxPackages);
%>

```{=html}
<div class="landing-packages">
<% for (const pkg of shown) { %>
<% const release = releases.get(pkg.title).release; %>
  <div class="landing-package">
    <a class="landing-package-name" href="<%= pkg.path %>"><%= pkg.title %></a>
    <span class="landing-package-status"><span class="visually-hidden">Status: </span><%= capitalise(pkg.status) %></span>
<% if (release) { %>
    <span class="landing-package-version"><span class="visually-hidden">Latest release: </span><%= release.version %></span>
    <time class="landing-package-date" datetime="<%= release.date %>"><%= releaseDate(release.date) %></time>
<% } else { %>
    <span class="landing-package-version"><span class="visually-hidden">Latest release: </span>—</span>
    <span class="landing-package-date" aria-hidden="true">—</span>
<% } %>
  </div>
<% } %>
</div>
```
