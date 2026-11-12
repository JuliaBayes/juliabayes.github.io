// RSS 2.0: https://www.rssboard.org/rss-specification
const xml = (text) => String(text)
  .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "")
  .replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);

export function releaseFeed(releases) {
  const items = [...new Map(releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => [release.id, release])).values()]
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
  const modified = items.reduce((latest, release) =>
    Math.max(latest, Date.parse(release.updated_at ?? release.published_at)), 0);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>JuliaBayes package releases</title>
  <link>https://juliabayes.org/ecosystem/</link>
  <description>Stable GitHub releases from packages in the JuliaBayes ecosystem.</description>
  <language>en</language>
  <atom:link href="https://juliabayes.org/releases.xml" rel="self" type="application/rss+xml"/>
${items.length ? `  <lastBuildDate>${new Date(modified).toUTCString()}</lastBuildDate>\n` : ""}${items.map((release) => `  <item>
    <title>${xml(`${release.package} ${release.tag_name}`)}</title>
    <link>${xml(release.html_url)}</link>
    <guid isPermaLink="false">github-release:${xml(release.id)}</guid>
    <pubDate>${new Date(release.published_at).toUTCString()}</pubDate>
    <category>${xml(release.package)}</category>
    <description>${xml(release.body_html ?? "")}</description>
  </item>`).join("\n")}
</channel>
</rss>
`;
}
