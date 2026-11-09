// JSON is also YAML, so Quarto can read the snapshot as listing data.
// Keep it committed for local renders. CI refreshes it before rendering.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const snapshot = new URL("../ecosystem/releases.yml", import.meta.url);
const packages = JSON.parse(readFileSync(snapshot, "utf8"));
const api = (endpoint) => JSON.parse(execFileSync("gh", ["api", endpoint], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 30000,
}));
const checked = new Date().toISOString().slice(0, 10);
const releases = packages.map((pkg) => {
  const name = pkg["release-package"];
  const repo = `repos/JuliaBayes/${name}`;
  let release;
  try {
    const data = api(`${repo}/releases/latest`);
    release = {
      version: data.tag_name,
      date: data.published_at.slice(0, 10),
      url: data.html_url,
    };
  } catch (error) {
    // A missing release is normal. A missing repository or other API error
    // must fail the update instead of replacing known data with an empty row.
    if (!error.stdout || JSON.parse(error.stdout).status !== "404") throw error;
    api(repo);
    release = null;
  }
  return { "release-package": name, release, checked };
});
writeFileSync(snapshot, `${JSON.stringify(releases, null, 2)}\n`);
