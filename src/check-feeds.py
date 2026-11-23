"""Validate rendered RSS and wait for Pages to serve the same files."""

import argparse
import json
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import urlopen


def parse_feed(content, filename):
    root = ET.fromstring(content)
    channel = root.find("channel")
    if root.tag != "rss" or channel is None or not all(
        channel.findtext(field) for field in ("title", "link", "description")
    ):
        raise ValueError(f"{filename} is missing required RSS channel fields")


def check_live(feeds, base_url):
    pending = set(feeds)
    deadline = time.monotonic() + 240
    while pending:
        errors = []
        for path in sorted(pending):
            url = f"{base_url.rstrip('/')}/{path}?verify={time.time_ns()}"
            try:
                with urlopen(url, timeout=10) as response:
                    published = response.read()
                parse_feed(published, path)
                if published != feeds[path]:
                    raise ValueError("Pages still serves a different build")
            except (OSError, ET.ParseError, ValueError) as error:
                errors.append(f"{path}: {error}")
            else:
                pending.remove(path)
        if not pending:
            break
        if time.monotonic() >= deadline:
            sys.exit("\n".join(errors))
        print("Waiting for Pages: " + "; ".join(errors), flush=True)
        time.sleep(10)
    print(f"Verified {len(feeds)} published RSS feeds")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    parser.add_argument("--live", help="Base URL of the published site or preview")
    args = parser.parse_args()
    snapshot = Path(__file__).resolve().parent.parent / "ecosystem/releases.yml"
    packages = json.loads(snapshot.read_text(encoding="utf-8"))
    paths = ["releases.xml", "news/index.xml"]
    paths.extend(pkg["feed"] for pkg in packages if pkg.get("feed"))
    feeds = {}
    for path in paths:
        content = (args.site / path).read_bytes()
        parse_feed(content, path)
        feeds[path] = content
    print(f"Validated {len(feeds)} rendered RSS feeds", flush=True)
    if args.live:
        check_live(feeds, args.live)


if __name__ == "__main__":
    main()
