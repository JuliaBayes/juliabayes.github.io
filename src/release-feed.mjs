// RSS 2.0: https://www.rssboard.org/rss-specification
const xml = (text) => String(text)
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
  .replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);

const site = "https://juliabayes.org";
const ecosystem = `${site}/ecosystem/`;
const releaseFeedTitle = (name) => name ? `JuliaBayes releases for ${name}` : "JuliaBayes package releases";

export function packageFeedOpml(packages) {
  const outlines = packages
    .filter((pkg) => pkg.feed)
    .sort((a, b) => a["release-package"].localeCompare(b["release-package"], "en"))
    .map((pkg) => {
      const title = xml(releaseFeedTitle(pkg["release-package"]));
      const feed = xml(`${site}/${pkg.feed}`);
      const releases = xml(`${pkg.repository}/releases`);
      return `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${feed}" htmlUrl="${releases}"/>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>JuliaBayes individual package feeds</title>
  </head>
  <body>
${outlines.join("\n")}
  </body>
</opml>
`;
}

export function releaseIdentity(repository, tag) {
  // In a monorepo, TagBot tags each subdirectory package as Name-vX.Y.Z. Such
  // a tag belongs to the repository package only if Name is that package.
  const match = /^([A-Za-z]\w*)-(v\d+\.\d+\.\d+(?:[-+].*)?)$/.exec(tag);
  if (!match) return { package: repository, version: tag };
  const [, name, version] = match;
  return { package: name === repository.replace(/\.jl$/, "") ? repository : name, version };
}

function releaseSummary(release) {
  const name = release.package;
  const tag = release.tag_name;
  const headings = [release.name, tag, `${name} ${tag}`, `${name.replace(/\.jl$/, "")} ${tag}`];
  const lines = (release.body_text ?? "").trim().split(/\r?\n/);
  while (lines.length && (!lines[0].trim() || headings.includes(lines[0].trim()) ||
    /^Diff since v?\d/.test(lines[0]))) {
    lines.shift();
  }
  const summary = lines.join(" ").replace(/\s+/g, " ").trim() || "See the release on GitHub.";
  const limit = 240;
  const characters = Array.from(summary);
  if (characters.length <= limit) return summary;
  const excerpt = characters.slice(0, limit - 1).join("");
  const lastSpace = excerpt.lastIndexOf(" ");
  return `${lastSpace > 0 ? excerpt.slice(0, lastSpace) : excerpt}…`;
}

export function releaseFeed(releases, path = "releases.xml", packageName) {
  const title = releaseFeedTitle(packageName);
  const description = packageName
    ? `Stable GitHub releases for ${packageName}.`
    : "Stable GitHub releases from packages in the JuliaBayes ecosystem.";
  const items = [...new Map(releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => [release.id, release])).values()]
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
  const modified = items.reduce((latest, release) =>
    Math.max(latest, Date.parse(release.updated_at ?? release.published_at)), 0);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${xml(title)}</title>
  <link>${ecosystem}</link>
  <description>${xml(description)}</description>
  <language>en</language>
  <image>
    <url>${site}/rss-icon.png</url>
    <title>${xml(title)}</title>
    <link>${ecosystem}</link>
    <width>32</width>
    <height>32</height>
  </image>
  <atom:link href="${xml(`${site}/${path}`)}" rel="self" type="application/rss+xml"/>
${items.length ? `  <lastBuildDate>${new Date(modified).toUTCString()}</lastBuildDate>\n` : ""}${items.map((release) => `  <item>
    <title>${xml(`${release.package} ${release.version}`)}</title>
    <link>${xml(release.html_url)}</link>
    <guid isPermaLink="false">github-release:${xml(release.id)}</guid>
    <pubDate>${new Date(release.published_at).toUTCString()}</pubDate>
    <category>${xml(release.package)}</category>
    <description>${xml(`<p>${xml(releaseSummary(release))}</p>`)}</description>${release.body_html ? `
    <content:encoded>${xml(release.body_html)}</content:encoded>` : ""}
  </item>`).join("\n")}
</channel>
</rss>
`;
}
