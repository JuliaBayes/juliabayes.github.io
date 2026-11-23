import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

function validateFeed(content, path) {
  // Quarto already ships Pandoc's XML reader in the preview and publish jobs.
  const parsed = spawnSync("quarto", ["pandoc", "--sandbox", "-f", "jats", "-t", "json"], {
    input: content, stdio: ["pipe", "ignore", "pipe"], encoding: "utf8",
  });
  if (parsed.error) throw parsed.error;
  if (parsed.status !== 0) throw new Error(`${path} is not valid XML: ${parsed.stderr.trim()}`);

  const fields = new Set();
  const stack = [];
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([a-z][\w.:-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>|([^<]+)/gi;
  for (const [, cdata, close, tag, attributes, text] of content.toString("utf8").matchAll(tokens)) {
    if (tag) {
      if (close) stack.pop();
      else if (!attributes.endsWith("/")) stack.push(tag);
    } else if (
      stack.length === 3 && stack[0] === "rss" && stack[1] === "channel" && (cdata ?? text)?.trim()
    ) {
      fields.add(stack[2]);
    }
  }
  if (!["title", "link", "description"].every((field) => fields.has(field))) {
    throw new Error(`${path} is missing required RSS channel fields`);
  }
}

async function checkLive(feeds, baseUrl) {
  const pending = new Map(feeds);
  const deadline = performance.now() + 240_000;
  while (pending.size) {
    const errors = [];
    for (const [path, expected] of pending) {
      const url = `${baseUrl.replace(/\/+$/, "")}/${path}?verify=${Date.now()}`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const published = Buffer.from(await response.arrayBuffer());
        if (!expected.equals(published)) throw new Error("Pages still serves a different build");
        pending.delete(path);
      } catch (error) {
        errors.push(`${path}: ${error.message}`);
      }
    }
    if (!pending.size) break;
    if (performance.now() >= deadline) throw new Error(errors.join("\n"));
    console.log(`Waiting for Pages: ${errors.join("; ")}`);
    await delay(10_000);
  }
  console.log(`Verified ${feeds.size} published RSS feeds`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { live: { type: "string" } },
});
if (positionals.length !== 1) throw new Error("Usage: node src/check-feeds.mjs <site> [--live <url>]");
const [site] = positionals;
const snapshot = new URL("../ecosystem/releases.yml", import.meta.url);
const packages = JSON.parse(readFileSync(snapshot, "utf8"));
const paths = ["releases.xml", "news/index.xml", ...packages.map(({ feed }) => feed).filter(Boolean)];
const feeds = new Map(paths.map((path) => {
  const content = readFileSync(join(site, path));
  validateFeed(content, path);
  return [path, content];
}));
console.log(`Validated ${feeds.size} rendered RSS feeds`);
if (values.live) await checkLive(feeds, values.live);
