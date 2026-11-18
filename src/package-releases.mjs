// JSON is also YAML, so Quarto can read the snapshot as listing data.
// Keep it committed for local renders. CI refreshes it before rendering.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const snapshot = new URL("../ecosystem/releases.yml", import.meta.url);
const packages = JSON.parse(readFileSync(snapshot, "utf8"));
const api = (endpoint, ...flags) => JSON.parse(execFileSync("gh", ["api", endpoint, ...flags], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 30000,
}));

function apiIfFound(endpoint) {
  try {
    return api(endpoint);
  } catch (error) {
    if (error.stdout && JSON.parse(error.stdout).status === "404") return null;
    throw error;
  }
}

function latestVersionTag(repo, repository) {
  const tags = api(`${repo}/tags?per_page=100`, "--paginate", "--slurp").flat();
  const versions = tags.map(({ name }) => name.match(/^v?(\d+\.\d+\.\d+)$/)).filter(Boolean);
  versions.sort((a, b) => b[1].localeCompare(a[1], "en", { numeric: true }));
  const version = versions[0]?.[0];
  if (!version) return null;

  const tag = encodeURIComponent(version);
  const { object } = api(`${repo}/git/ref/tags/${tag}`);
  // Lightweight tags carry no tag date. The commit date is not a substitute.
  const date = object.type === "tag" ? api(`${repo}/git/tags/${object.sha}`).tagger.date.slice(0, 10) : null;
  return { version, date, url: `${repository}/tree/${tag}`, source: "tag" };
}

const checked = new Date().toISOString().slice(0, 10);
const releases = packages.map((pkg) => {
  const name = pkg["release-package"];
  const repo = `repos/JuliaBayes/${name}`;
  const record = { "release-package": name, repository: null, release: null, checked };
  const metadata = apiIfFound(repo);
  // Local credentials can see private repos that CI and visitors cannot.
  if (!metadata || metadata.private) return record;
  record.repository = metadata.html_url;
  const data = apiIfFound(`${repo}/releases/latest`);
  const release = data ? {
    version: data.tag_name,
    date: data.published_at.slice(0, 10),
    url: data.html_url,
  } : latestVersionTag(repo, record.repository);
  return { ...record, release };
});
writeFileSync(snapshot, `${JSON.stringify(releases, null, 2)}\n`);
