<%
// The listing reads packages.yml and the team entries in about/people/.
// Package entries carry a `task`; team entries carry a `name`.
const statuses = ["experimental", "registered", "stable"];
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const packages = items.filter((item) => item.task !== undefined);
const people = items.filter((item) => item.name !== undefined);
const releases = new Map(items
  .filter((item) => item["release-package"] !== undefined)
  .map((item) => [item["release-package"], item]));
const releaseDate = (date) => new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
}).format(new Date(date));

const maintainersOf = (pkg) =>
  people
    .filter((person) => (person.packages ?? []).includes(pkg.title));

// Up to four maintainers are shown by name; with more, three names and a count
// of the rest. ecosystem/maintainers.html hides further names when the line
// would overflow.
const maxNamedMaintainers = 4;
const namedMaintainerCount = (count) =>
  count > maxNamedMaintainers ? maxNamedMaintainers - 1 : count;

// A backslash escapes any ASCII punctuation in Pandoc's Markdown.
const escapeMarkdown = (text) => text.replace(/[!-\/:-@\[-`{-~]/g, "\\$&");

const maintainersMarkdown = (maintainers) => {
  const shown = namedMaintainerCount(maintainers.length);
  const names = maintainers.map((person, i) => {
    const name = escapeMarkdown(person.name);
    const label = person.github ? `[${name}](https://github.com/${encodeURIComponent(person.github)})` : name;
    return `[${label}]{.ecosystem-maintainer${i < shown ? "" : " hidden=hidden"}}`;
  });
  const hiddenCount = maintainers.length - shown;
  const more = `[+${hiddenCount}]{.ecosystem-maintainers-more${hiddenCount ? "" : " hidden=hidden"}}`;
  return names.join("") + more;
};

for (const pkg of packages) {
  if (!releases.has(pkg.title)) {
    throw new Error(`Add ${pkg.title} to ecosystem/releases.yml and run node src/package-releases.mjs`);
  }
  if (!statuses.includes(pkg.status)) {
    throw new Error(
      `${pkg.title} in ecosystem/packages.yml has status "${pkg.status}"; ` +
      `expected one of: ${statuses.join(", ")}`
    );
  }
}

const byOrderThenTitle = (a, b) =>
  a.order - b.order || a.title.localeCompare(b.title);
const tasks = [...new Set(packages.sort(byOrderThenTitle).map((pkg) => pkg.task))];
%>

```{=html}
<form id="ecosystem-filters" class="ecosystem-filters" role="search" aria-label="Find packages" hidden>
  <div>
    <label for="package-search" class="form-label">Search packages</label>
    <input id="package-search" class="form-control" type="search" placeholder="Package name" aria-controls="listing-packages" autocomplete="off">
  </div>
  <div>
    <label for="package-task" class="form-label">Task</label>
    <select id="package-task" class="form-select" aria-controls="listing-packages">
      <option value="">All tasks</option>
      <% for (const task of tasks) { %>
      <option value="<%= task %>"><%= task %></option>
      <% } %>
    </select>
  </div>
  <button type="reset" class="btn btn-outline-secondary">Clear</button>
  <p id="package-count" role="status" aria-live="polite" aria-atomic="true"></p>
</form>

<p id="package-empty" hidden>No packages match. Try another name or task.</p>
```

::: {.ecosystem-list}

<% for (const task of tasks) { %>
::: {.ecosystem-card .accent-card .accent-blue data-task="<%= task %>"}

## <%= task %> {.unnumbered .unlisted}

<% for (const pkg of packages.filter((p) => p.task === task)) { %>
<% const maintainers = maintainersOf(pkg); %>
<% const repository = releases.get(pkg.title).repository; %>
<% const release = releases.get(pkg.title).release; %>
::: {.ecosystem-package data-name="<%= pkg.title %>"}

::: {.ecosystem-package-text}

[<%= pkg.title %>](<%= pkg.path %>){.ecosystem-package-name .stretched-link}

<%= pkg.description %>

::: {.ecosystem-links}
[Docs](<%= pkg.path %>){aria-label="<%= pkg.title %> documentation"}
<% if (repository) { %>[GitHub](<%= repository %>){aria-label="<%= pkg.title %> on GitHub"}
[Issues](<%= repository %>/issues){aria-label="<%= pkg.title %> issues"}<% } %>
:::

::: {.ecosystem-meta}

<% if (maintainers.length) { %>
::: {.ecosystem-maintainers data-named-count="<%= namedMaintainerCount(maintainers.length) %>"}
Maintained by: <%- maintainersMarkdown(maintainers) %>
:::
<% } %>

Status: <%= capitalise(pkg.status) %>

::: {.ecosystem-release}
<% if (release) { %>
Latest release: [<%= escapeMarkdown(release.version) %>](<%= release.url %>) · <time datetime="<%= release.date %>"><%= releaseDate(release.date) %></time>
<% } else if (repository) { %>
No stable GitHub release yet.
<% } else { %>
Release info unavailable.
<% } %>
:::

:::

:::

<% if (pkg.logo) { %>
::: {.ecosystem-logo}
![](<%= pkg.logo %>){alt=""}
:::
<% } else { %>
::: {.ecosystem-logo .ecosystem-logo-empty}
:::
<% } %>

:::

<% } %>

:::
<% } %>

:::

::: {.ecosystem-release-note}
GitHub release data checked <%= releaseDate([...releases.values()].map((item) => item.checked).sort()[0]) %>.
:::
