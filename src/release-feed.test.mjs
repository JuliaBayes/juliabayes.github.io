import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { releaseFeed } from "./release-feed.mjs";

function fixture(t, responses) {
  const dir = mkdtempSync(join(tmpdir(), "juliabayes-feed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ["src", "ecosystem", "bin"]) mkdirSync(join(dir, name));
  for (const name of ["package-releases.mjs", "release-feed.mjs"]) {
    copyFileSync(new URL(name, import.meta.url), join(dir, "src", name));
  }
  writeFileSync(join(dir, "ecosystem/releases.yml"), JSON.stringify([
    { "release-package": "Test.jl" }, { "release-package": "Private.jl" },
  ]));
  writeFileSync(join(dir, "bin/gh"), `#!/usr/bin/env node
import { readFileSync } from "node:fs";
const args = process.argv.slice(2);
const endpoint = args[1];
if (endpoint.includes("?per_page=")) {
  if (!args.includes("--paginate") || !args.includes("--slurp")) process.exit(2);
  if (!args.includes("Accept: application/vnd.github.html+json")) process.exit(2);
}
const responses = JSON.parse(readFileSync(process.env.RELEASE_FIXTURE));
const response = responses[endpoint];
if (response === undefined) throw new Error("Unexpected API call: " + endpoint);
console.log(JSON.stringify(response));
if (response.status) process.exit(1);
`, { mode: 0o755 });
  const data = join(dir, "responses.json");
  const save = () => writeFileSync(data, JSON.stringify(responses));
  save();
  const run = () => spawnSync(process.execPath, [join(dir, "src/package-releases.mjs")], {
    env: { ...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}`, RELEASE_FIXTURE: data },
    encoding: "utf8",
  });
  return {
    run, save,
    feed: () => readFileSync(join(dir, "releases.xml"), "utf8"),
    snapshot: () => readFileSync(join(dir, "ecosystem/releases.yml"), "utf8"),
  };
}

const release = (id, overrides = {}) => ({
  id, tag_name: `v${id}.0.0`, published_at: `2026-11-0${id}T12:00:00Z`,
  updated_at: `2026-11-0${id}T12:00:00Z`,
  html_url: `https://github.com/JuliaBayes/Test.jl/releases/tag/v${id}.0.0`,
  body_html: "<p>Fish &amp; chips 🐟\u0001</p>", draft: false, prerelease: false,
  ...overrides,
});
const responses = () => ({
  "repos/JuliaBayes/Test.jl": { private: false, html_url: "https://github.com/JuliaBayes/Test.jl" },
  "repos/JuliaBayes/Private.jl": { private: true },
  "repos/JuliaBayes/Test.jl/releases/latest": release(3),
  "repos/JuliaBayes/Test.jl/releases?per_page=100": [
    [release(3), release(2), release(5, { prerelease: true })],
    [release(2), release(1), release(4, { draft: true })],
  ],
});
const identities = (xml) => [...xml.matchAll(/<guid isPermaLink="false">([^<]+)<\/guid>/g)]
  .map((match) => match[1]);

test("publishes all stable history once and keeps identities across edits", (t) => {
  const data = responses();
  const f = fixture(t, data);
  let result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(identities(f.feed()), ["github-release:3", "github-release:2", "github-release:1"]);
  assert.ok(f.feed().includes("&lt;p&gt;Fish &amp;amp; chips 🐟&lt;/p&gt;"));
  const history = data["repos/JuliaBayes/Test.jl/releases?per_page=100"];
  for (const page of history) {
    for (const item of page.filter((item) => item.id === 2)) {
      item.tag_name = "renamed";
      item.html_url = "https://github.com/JuliaBayes/Test.jl/releases/tag/renamed";
      item.body_html = "<p>Edited notes.</p>";
      item.updated_at = "2026-11-06T12:00:00Z";
    }
  }
  f.save();
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const edited = f.feed();
  assert.deepEqual(identities(edited), ["github-release:3", "github-release:2", "github-release:1"]);
  assert.ok(edited.includes("<title>Test.jl renamed</title>"));
  assert.ok(edited.includes("Fri, 06 Nov 2026 12:00:00 GMT"));
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.feed(), edited);
});

test("API failure preserves both existing snapshots", (t) => {
  const data = responses();
  const f = fixture(t, data);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const before = { feed: f.feed(), snapshot: f.snapshot() };
  data["repos/JuliaBayes/Test.jl/releases?per_page=100"] = { status: "503" };
  f.save();
  assert.notEqual(f.run().status, 0);
  assert.equal(f.feed(), before.feed);
  assert.equal(f.snapshot(), before.snapshot);
});

test("an empty history produces a subscribable channel without invalid dates", () => {
  const xml = releaseFeed([]);
  assert.deepEqual(identities(xml), []);
  assert.ok(xml.includes('href="https://juliabayes.org/releases.xml"'));
  assert.ok(!xml.includes("Invalid Date"));
});
