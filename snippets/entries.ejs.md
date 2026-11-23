<%
const tags = [...new Set(items.flatMap((item) => item.categories ?? []))].sort((a, b) => a.localeCompare(b));
%>

<% if (items.length) { %>
```{=html}
<form id="snippet-filters" class="listing-filters" role="search" aria-label="Find snippets" hidden>
  <div>
    <label for="snippet-search" class="form-label">Search snippets</label>
    <input id="snippet-search" class="form-control" type="search" placeholder="Title, summary, author or tag" aria-controls="listing-snippet-entries" autocomplete="off">
  </div>
  <% if (tags.length) { %>
  <div>
    <span class="form-label d-block">Tags</span>
    <details class="listing-filter-dropdown">
      <summary aria-controls="snippet-tag-menu"><span class="visually-hidden">Filter by tag: </span><span data-filter-summary>All tags</span></summary>
      <div id="snippet-tag-menu" class="listing-filter-menu">
        <fieldset>
          <legend class="visually-hidden">Show snippets with any selected tag</legend>
          <% for (const tag of tags) { %>
          <label><input type="checkbox" value="<%- tag %>" aria-controls="listing-snippet-entries"> <%- tag %></label>
          <% } %>
        </fieldset>
      </div>
    </details>
  </div>
  <% } %>
  <button type="reset" class="btn">Clear</button>
  <p role="status" aria-live="polite" aria-atomic="true"></p>
</form>

<p id="snippet-empty" hidden>No snippets match.</p>

<% for (const item of items) { %>
<div class="quarto-post snippet-entry">
  <div class="body">
    <h2 class="no-anchor listing-title"><a href="<%- item.path %>"><%- item.title %></a></h2>
    <div class="listing-description"><%- item.description %></div>
    <% if (item.categories?.length) { %>
    <div class="listing-categories">
      <% for (const tag of item.categories) { %>
      <span class="listing-category"><%- tag %></span>
      <% } %>
    </div>
    <% } %>
  </div>
  <div class="metadata">
    <div class="listing-author"><%- item.author %></div>
    <div class="listing-date"><%- item.date %></div>
  </div>
</div>
<% } %>
```
<% } else { %>
No snippets yet.
<% } %>
