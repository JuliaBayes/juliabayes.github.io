import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, sep } from "node:path";
import { parseArgs } from "node:util";

const host = "juliabayes.org";
const entities = new Map(Object.entries({ amp: "&", apos: "'", gt: ">", lt: "<", nbsp: "\u00a0", quot: '"' }));
const rawTextTags = new Set(["script", "style", "textarea", "title"]);

function decodeAttribute(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (_reference, entity) => {
    if (!entity.startsWith("#")) {
      if (!entities.has(entity)) {
        // Use Quarto's HTML reader for less common named references.
        const ast = JSON.parse(execFileSync("quarto", ["pandoc", "-f", "html+native_spans", "-t", "json"], {
          input: `<span id="x&${entity};y">x</span>`, encoding: "utf8",
        }));
        entities.set(entity, ast.blocks[0].c[0].c[0][0].slice(1, -1));
      }
      return entities.get(entity);
    }
    const digits = entity.slice(1);
    const point = /^x/i.test(digits) ? Number.parseInt(digits.slice(1), 16) : Number(digits);
    return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
      ? String.fromCodePoint(point)
      : "\ufffd";
  });
}

function readPage(html) {
  // Match whole start tags so quoted > signs cannot end a tag.
  const tags = /<!--[\s\S]*?(?:-->|$)|<([a-z][\w:-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/gi;
  const attributes = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  const anchors = new Set();
  const links = [];
  let offset = 0;
  let line = 1;
  for (let token; (token = tags.exec(html));) {
    if (!token[1]) continue;
    const tag = token[1].toLowerCase();
    const attrs = new Map();
    for (const [, key, double, single, plain] of token[2].matchAll(attributes)) {
      const name = key.toLowerCase();
      if (name !== "id" && (tag !== "a" || (name !== "href" && name !== "name"))) continue;
      if (!attrs.has(name)) attrs.set(name, decodeAttribute(double ?? single ?? plain ?? ""));
    }
    if (attrs.get("id")) anchors.add(attrs.get("id"));
    if (tag === "a") {
      if (attrs.get("name")) anchors.add(attrs.get("name"));
      const href = attrs.get("href");
      if (href) {
        line += html.slice(offset, token.index).split("\n").length - 1;
        offset = token.index;
        links.push({ line, href });
      }
    }
    if (rawTextTags.has(tag)) {
      const end = new RegExp(`</${tag}\\s*>`, "gi");
      end.lastIndex = tags.lastIndex;
      tags.lastIndex = end.test(html) ? end.lastIndex : html.length;
    }
  }
  return { links, anchors };
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function checkLinks(site, sitePath) {
  const prefix = `/${sitePath.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\//, "/");
  const pages = new Map(readdirSync(site, { recursive: true })
    .filter((name) => name.endsWith(".html"))
    .sort()
    .map((name) => [name.split(sep).join("/"), readPage(readFileSync(join(site, name), "utf8"))]));
  if (pages.size === 0) throw new Error(`No HTML pages found in ${site}`);

  const errors = [];
  for (const [source, page] of pages) {
    const base = `https://${host}${prefix}${source.split("/").map(encodeURIComponent).join("/")}`;
    for (const { line, href } of page.links) {
      let url;
      try {
        url = new URL(href, base);
      } catch {
        errors.push(`${source}:${line}: invalid URL ${JSON.stringify(href)}`);
        continue;
      }
      if (url.host !== host || !["http:", "https:"].includes(url.protocol)) continue;
      const path = posix.normalize(decodePath(url.pathname));
      let destination = path === prefix.slice(0, -1) ? "" :
        path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\/+/, "");
      // Package docs and other PR previews have their own Pages builds.
      const first = destination.split("/", 1)[0].toLowerCase();
      if (first.endsWith(".jl") || first === "previews") continue;
      if (statSync(join(site, destination), { throwIfNoEntry: false })?.isDirectory()) {
        destination = posix.join(destination, "index.html");
      }
      const fragment = decodePath(url.hash.slice(1).split(":~:", 1)[0]);
      const target = pages.get(destination);
      const location = `${source}:${line}: ${JSON.stringify(href)}`;
      if (!statSync(join(site, destination), { throwIfNoEntry: false })?.isFile()) {
        errors.push(`${location} points to missing ${destination}`);
      } else if (target && fragment && fragment.toLowerCase() !== "top" && !target.anchors.has(fragment)) {
        errors.push(`${location} points to missing #${fragment} in ${destination}`);
      }
    }
  }
  return { count: pages.size, errors };
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { "site-path": { type: "string", default: "/" } },
});
if (positionals.length !== 1) throw new Error("Usage: node src/check-links.mjs <site> [--site-path <path>]");
const { count, errors } = checkLinks(positionals[0], values["site-path"]);
if (errors.length) {
  process.exitCode = 1;
  console.error(errors.join("\n"));
} else {
  console.log(`Checked links on ${count} HTML pages`);
}
