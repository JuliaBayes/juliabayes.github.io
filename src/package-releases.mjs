// JSON is also YAML, so Quarto can read the snapshot as listing data.
// Keep it committed for local renders. CI refreshes it before rendering.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { releaseFeed } from "./release-feed.mjs";

const snapshot = new URL("../ecosystem/releases.yml", import.meta.url);
const packages = JSON.parse(readFileSync(snapshot, "utf8"));
const api = (endpoint, paginate = false) => JSON.parse(execFileSync("gh", [
  "api", endpoint,
  ...(paginate ? ["--paginate", "--slurp", "-H", "Accept: application/vnd.github.html+json"] : []),
], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 30000,
}));
const checked = new Date().toISOString().slice(0, 10);
const history = [];
const releases = packages.map((pkg) => {
  const name = pkg["release-package"];
  const repo = `repos/JuliaBayes/${name}`;
  const record = { "release-package": name, repository: null, release: null, checked };
  let metadata;
  try {
    metadata = api(repo);
  } catch (error) {
    if (error.stdout && JSON.parse(error.stdout).status === "404") return record;
    throw error;
  }
  // Local credentials can see private repos that CI and visitors cannot.
  if (metadata.private) return record;
  record.repository = metadata.html_url;
  for (const page of api(`${repo}/releases?per_page=100`, true)) {
    history.push(...page.map((release) => ({ ...release, package: name })));
  }
  let release;
  try {
    const data = api(`${repo}/releases/latest`);
    release = {
      version: data.tag_name,
      date: data.published_at.slice(0, 10),
      url: data.html_url,
    };
  } catch (error) {
    // A public repo without a stable release is normal. Other API errors
    // must fail the update instead of replacing known data with an empty row.
    if (!error.stdout || JSON.parse(error.stdout).status !== "404") throw error;
    release = null;
  }
  return { ...record, release };
});
const feed = releaseFeed(history);
writeFileSync(snapshot, `${JSON.stringify(releases, null, 2)}\n`);
writeFileSync(new URL("../releases.xml", import.meta.url), feed);
