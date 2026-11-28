import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { releaseFeed, releaseIdentity } from "./release-feed.mjs";

function fixture(t, responses) {
  const dir = mkdtempSync(join(tmpdir(), "juliabayes-feed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ["src", "ecosystem", "bin"]) mkdirSync(join(dir, name));
  for (const name of ["package-releases.mjs", "release-feed.mjs"]) {
    copyFileSync(new URL(name, import.meta.url), join(dir, "src", name));
  }
  writeFileSync(join(dir, "ecosystem/releases.yml"), JSON.stringify([
    { "release-package": "Test.jl" }, { "release-package": "Private.jl" },
    { "release-package": "Wren.jl" },
  ]));
  writeFileSync(join(dir, "bin/gh"), `#!/usr/bin/env node
import { readFileSync } from "node:fs";
const args = process.argv.slice(2);
const endpoint = args[1];
if (endpoint.includes("?per_page=")) {
  if (!args.includes("--paginate") || !args.includes("--slurp")) process.exit(2);
  if (endpoint.includes("/releases?") && !args.includes("Accept: application/vnd.github.full+json")) process.exit(2);
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
    packageFeed: (name) => readFileSync(join(dir, "releases", name), "utf8"),
    packageFeeds: () => readdirSync(join(dir, "releases")).sort(),
    packageOpml: () => readFileSync(join(dir, "package-feeds.opml"), "utf8"),
    snapshot: () => readFileSync(join(dir, "ecosystem/releases.yml"), "utf8"),
  };
}

const release = (id, overrides = {}) => ({
  id, tag_name: `v${id}.0.0`, published_at: `2026-11-0${id}T12:00:00Z`,
  updated_at: `2026-11-0${id}T12:00:00Z`,
  html_url: `https://github.com/JuliaBayes/Test.jl/releases/tag/v${id}.0.0`,
  body_text: `Test v${id}.0.0\nDiff since v0.9.0\nFish & chips 🐟 with <lime>. ${"More notes. ".repeat(30)}`,
  body_html: "<p>Fish &amp; chips 🐟\u0001</p>", draft: false, prerelease: false,
  ...overrides,
});
const wrenDists = release(6, {
  tag_name: "WrenDists-v0.1.0",
  html_url: "https://github.com/JuliaBayes/Wren.jl/releases/tag/WrenDists-v0.1.0",
  body_text: "WrenDists WrenDists-v0.1.0\nFirst WrenDists release.",
});
const wrenCore = release(7, {
  tag_name: "WrenCore-v0.1.0",
  html_url: "https://github.com/JuliaBayes/Wren.jl/releases/tag/WrenCore-v0.1.0",
  body_text: "WrenCore WrenCore-v0.1.0\nFirst WrenCore release.",
});
const responses = () => ({
  "repos/JuliaBayes/Test.jl": { private: false, html_url: "https://github.com/JuliaBayes/Test.jl" },
  "repos/JuliaBayes/Private.jl": { private: true },
  "repos/JuliaBayes/Wren.jl": { private: false, html_url: "https://github.com/JuliaBayes/Wren.jl" },
  "repos/JuliaBayes/Wren.jl/releases/latest": wrenCore,
  "repos/JuliaBayes/Wren.jl/releases?per_page=100": [[wrenCore, wrenDists]],
  "repos/JuliaBayes/Wren.jl/tags?per_page=100": [[{ name: wrenCore.tag_name }, { name: wrenDists.tag_name }]],
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
  const ids = ["github-release:7", "github-release:6", "github-release:3", "github-release:2", "github-release:1"];
  assert.deepEqual(identities(f.feed()), ids);
  const summary = f.feed().match(/<description>&lt;p&gt;(Fish .+?)&lt;\/p&gt;<\/description>/)[1];
  assert.ok(summary.startsWith("Fish &amp;amp; chips 🐟 with &amp;lt;lime&amp;gt;."));
  assert.ok(summary.endsWith("…"));
  assert.ok(Array.from(summary.replace(/&amp;(?:amp|lt|gt);/g, "_")).length <= 240);
  assert.ok(f.feed().includes("<content:encoded>&lt;p&gt;Fish &amp;amp; chips 🐟&lt;/p&gt;</content:encoded>"));
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
  assert.deepEqual(identities(edited), ids);
  assert.ok(edited.includes("<title>Test.jl renamed</title>"));
  assert.ok(edited.includes("Fri, 06 Nov 2026 12:00:00 GMT"));
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.feed(), edited);
});

test("API failure preserves the existing release data and feeds", (t) => {
  const data = responses();
  const f = fixture(t, data);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const before = {
    feed: f.feed(), snapshot: f.snapshot(), package: f.packageFeed("test.jl.xml"), opml: f.packageOpml(),
  };
  data["repos/JuliaBayes/Test.jl/releases?per_page=100"] = { status: "503" };
  f.save();
  assert.notEqual(f.run().status, 0);
  assert.equal(f.feed(), before.feed);
  assert.equal(f.snapshot(), before.snapshot);
  assert.equal(f.packageFeed("test.jl.xml"), before.package);
  assert.equal(f.packageOpml(), before.opml);
});

test("package feeds contain only their own releases and follow repository visibility", (t) => {
  const data = responses();
  const f = fixture(t, data);
  let result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.packageFeeds(), ["test.jl.xml", "wren.jl.xml"]);
  assert.deepEqual([...f.packageOpml().matchAll(/xmlUrl="([^"]+)"/g)].map(([, url]) => url), [
    "https://juliabayes.org/releases/test.jl.xml", "https://juliabayes.org/releases/wren.jl.xml",
  ]);
  assert.deepEqual(identities(f.packageFeed("test.jl.xml")), ["github-release:3", "github-release:2", "github-release:1"]);
  assert.deepEqual(identities(f.packageFeed("wren.jl.xml")), []);
  assert.ok(f.feed().includes("<title>WrenDists v0.1.0</title>"));
  assert.ok(f.feed().includes("<category>WrenDists</category>"));
  assert.ok(f.feed().includes("<title>WrenCore v0.1.0</title>"));
  assert.ok(f.packageFeed("test.jl.xml").includes('href="https://juliabayes.org/releases/test.jl.xml"'));
  assert.equal(JSON.parse(f.snapshot()).find((pkg) => pkg["release-package"] === "Wren.jl").release, null);

  data["repos/JuliaBayes/Test.jl"].private = true;
  f.save();
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.packageFeeds(), ["wren.jl.xml"]);
  assert.ok(!f.packageOpml().includes("test.jl.xml"));
  assert.deepEqual(identities(f.feed()), ["github-release:7", "github-release:6"]);
});

test("monorepo tags belong to the package that the prefix names", () => {
  assert.deepEqual(releaseIdentity("Wren.jl", "WrenCore-v0.1.0"), { package: "WrenCore", version: "v0.1.0" });
  assert.deepEqual(releaseIdentity("Wren.jl", "Wren-v0.2.0"), { package: "Wren.jl", version: "v0.2.0" });
  assert.deepEqual(releaseIdentity("Wren.jl", "v0.2.0"), { package: "Wren.jl", version: "v0.2.0" });
  assert.deepEqual(releaseIdentity("Test.jl", "renamed"), { package: "Test.jl", version: "renamed" });
});

test("an empty history produces a subscribable channel without invalid dates", () => {
  const xml = releaseFeed([]);
  assert.deepEqual(identities(xml), []);
  assert.ok(xml.includes('href="https://juliabayes.org/releases.xml"'));
  assert.ok(!xml.includes("Invalid Date"));
});
