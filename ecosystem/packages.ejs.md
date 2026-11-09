<%
// The listing reads packages.yml and the team entries in about/people/.
// Package entries carry a `task`; team entries carry a `name`.
const statuses = ["experimental", "established", "stable"];
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const packages = items.filter((item) => item.task !== undefined);
const people = items.filter((item) => item.name !== undefined);

const maintainersOf = (pkg) =>
  people
    .filter((person) => (person.packages ?? []).includes(pkg.title))
    .map((person) => person.name);

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
  const names = maintainers.map((name, i) =>
    `[${escapeMarkdown(name)}]{.ecosystem-maintainer${i < shown ? "" : " hidden=hidden"}}`
  );
  const hiddenCount = maintainers.length - shown;
  const more = `[+${hiddenCount}]{.ecosystem-maintainers-more${hiddenCount ? "" : " hidden=hidden"}}`;
  return names.join("") + more;
};

for (const pkg of packages) {
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

::: {.ecosystem-list}

<% for (const task of tasks) { %>
::: {.ecosystem-card .accent-card .accent-blue}

## <%= task %> {.unnumbered .unlisted}

<% for (const pkg of packages.filter((p) => p.task === task)) { %>
<% const maintainers = maintainersOf(pkg); %>
::: {.ecosystem-package}

::: {.ecosystem-package-text}

[<%= pkg.title %>](<%= pkg.path %>){.ecosystem-package-name .stretched-link}

<%= pkg.description %>

::: {.ecosystem-meta}

::: {.ecosystem-maintainers data-named-count="<%= namedMaintainerCount(maintainers.length) %>"}
Maintained by: <%- maintainersMarkdown(maintainers) %>
:::

Status: <%= capitalise(pkg.status) %>

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
