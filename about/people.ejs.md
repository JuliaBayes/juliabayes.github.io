<%
// One row per file in about/people/. See about/people/README.md for the
// fields. Optional fields render only when set.
const repo = (pkg) => `https://github.com/JuliaBayes/${pkg}`;
%>

::: {.team-list}

<% for (const item of items) { %>
::: {.team-person <%= metadataAttrs(item) %>}

<% if (item.image) { %>
![](people/<%= item.image %>){.team-avatar alt="" width="80" height="80"}
<% } else { %>
[]{.team-avatar .team-avatar-empty}
<% } %>

::: {.team-body}

### <%= item.name %><% if (item.pronouns) { %> [<%= item.pronouns %>]{.team-pronouns}<% } %> {.team-name .unnumbered .unlisted}

Role
: <%= item.role %>

<% if (item.affiliation) { %>
Affiliation
: <%= item.affiliation %>

<% } %>
<% if (item.packages && item.packages.length) { %>
Packages
: <%= item.packages.map(p => `[${p}](${repo(p)})`).join(", ") %>

<% } %>
<% if (item.bio) { %>
Bio
: <%= item.bio %>

<% } %>
GitHub
: [<%= item.github %>](https://github.com/<%= item.github %>)

<% if (item.website) { %>
Website
: [<%= item.website.replace(/^https?:\/\//, "").replace(/\/$/, "") %>](<%= item.website %>)

<% } %>
<% if (item.email) { %>
Email
: [<%= item.email %>](mailto:<%= item.email %>)

<% } %>
:::

:::
<% } %>

:::
