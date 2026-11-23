"""Check internal links and HTML anchors in a rendered site."""

import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path
from posixpath import normpath
from urllib.parse import quote, unquote, urljoin, urlsplit

SITE_HOST = "juliabayes.org"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[tuple[int, str]] = []
        self.anchors: set[str] = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if anchor := attributes.get("id"):
            self.anchors.add(anchor)
        if tag == "a":
            if name := attributes.get("name"):
                self.anchors.add(name)
            if href := attributes.get("href"):
                self.links.append((self.getpos()[0], href))


def check_links(site, site_path):
    prefix = "/" + site_path.strip("/") + "/" if site_path.strip("/") else "/"
    pages = {}
    for path in sorted(site.rglob("*.html")):
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        page.close()
        pages[path.relative_to(site).as_posix()] = page
    if not pages:
        sys.exit(f"No HTML pages found in {site}")

    errors = []
    for source, page in pages.items():
        base = f"https://{SITE_HOST}{prefix}{quote(source)}"
        for line, href in page.links:
            url = urlsplit(urljoin(base, href))
            if url.scheme not in {"http", "https"} or url.netloc.lower() != SITE_HOST:
                continue
            path = normpath(unquote(url.path))
            if path == prefix.rstrip("/"):
                path = "/"
            else:
                path = path.removeprefix(prefix).lstrip("/")
            # Package docs and other PR previews have their own Pages builds.
            first = path.partition("/")[0].lower()
            if first.endswith(".jl") or first == "previews":
                continue
            target = site / path.lstrip("/")
            if target.is_dir():
                target /= "index.html"
            destination = target.relative_to(site).as_posix()
            fragment = unquote(url.fragment.partition(":~:")[0])
            if not target.is_file():
                errors.append(f"{source}:{line}: {href!r} points to missing {destination}")
            elif (
                fragment
                and fragment.lower() != "top"
                and destination in pages
                and fragment not in pages[destination].anchors
            ):
                errors.append(f"{source}:{line}: {href!r} points to missing #{fragment} in {destination}")
    return len(pages), errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    parser.add_argument("--site-path", default="/")
    args = parser.parse_args()
    count, errors = check_links(args.site, args.site_path)
    if errors:
        sys.exit("\n".join(errors))
    print(f"Checked links on {count} HTML pages")


if __name__ == "__main__":
    main()
