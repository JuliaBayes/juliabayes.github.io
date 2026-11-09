<%
// The listing reads packages.yml and the team entries in about/people/.
// Package entries carry a `task`; team entries carry a `name`.
const statuses = ["unregistered", "registered", "stable"];
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

// A backslash escapes any ASCII punctuation in Pandoc's Markdown.
const escapeMarkdown = (text) => text.replace(/[!-\/:-@\[-`{-~]/g, "\\$&");
const escapeHtml = (text) => text.replace(/[&<>]/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);

const maintainersHtml = (maintainers, pkg) => {
  const names = maintainers.map((person) => {
    const name = escapeHtml(person.name);
    const label = person.github ? `<a href="https://github.com/${encodeURIComponent(person.github)}">${name}</a>` : name;
    return `<span class="ecosystem-maintainer">${label}</span>`;
  });
  const id = `maintainers-${pkg.title.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const more = `<button type="button" class="ecosystem-maintainers-more" aria-controls="${id}" aria-expanded="false" hidden>Show all</button>`;
  return `<span id="${id}">${names.join("")}</span>` + more;
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
    <input id="package-search" class="form-control" type="search" placeholder="Name, description or maintainer" aria-controls="listing-packages" autocomplete="off">
  </div>
  <div>
    <span class="form-label d-block">Tasks</span>
    <details id="package-tasks" class="ecosystem-filter-dropdown">
      <summary aria-controls="package-task-menu"><span class="visually-hidden">Filter by task: </span><span data-filter-summary>All tasks</span></summary>
      <div id="package-task-menu" class="ecosystem-filter-menu">
        <fieldset>
          <legend class="visually-hidden">Show packages for any selected task</legend>
      <% for (const task of tasks) { %>
          <label><input type="checkbox" name="task" value="<%= task %>" aria-controls="listing-packages"> <%= task %></label>
      <% } %>
        </fieldset>
      </div>
    </details>
  </div>
  <div>
    <span class="form-label d-block">Status</span>
    <details id="package-statuses" class="ecosystem-filter-dropdown">
      <summary aria-controls="package-status-menu"><span class="visually-hidden">Filter by status: </span><span data-filter-summary>All statuses</span></summary>
      <div id="package-status-menu" class="ecosystem-filter-menu">
        <fieldset>
          <legend class="visually-hidden">Show packages with any selected status</legend>
      <% for (const status of statuses) { %>
          <label><input type="checkbox" name="status" value="<%= status %>" aria-controls="listing-packages"> <%= capitalise(status) %></label>
      <% } %>
        </fieldset>
      </div>
    </details>
  </div>
  <button type="reset" class="btn">Clear</button>
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
::: {.ecosystem-package data-name="<%= pkg.title %>" data-status="<%= pkg.status %>"}

::: {.ecosystem-package-text}

[<%= pkg.title %>](<%= pkg.path %>){.ecosystem-package-name .stretched-link}

::: {.ecosystem-links}
[Docs](<%= pkg.path %>){aria-label="<%= pkg.title %> documentation"}
<% if (repository) { %>[GitHub](<%= repository %>){aria-label="<%= pkg.title %> on GitHub"}
[Issues](<%= repository %>/issues){aria-label="<%= pkg.title %> issues"}<% } %>
:::

::: {.ecosystem-description}
<%= pkg.description %>
:::

::: {.ecosystem-meta}

<% if (maintainers.length) { %>
::: {.ecosystem-maintainers}
```{=html}
<p>Maintained by: <%= maintainersHtml(maintainers, pkg) %></p>
```
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
<% } %>

:::

<% } %>

:::
<% } %>

:::

::: {.ecosystem-release-note}
GitHub release data checked <%= releaseDate([...releases.values()].map((item) => item.checked).sort()[0]) %>.
:::
