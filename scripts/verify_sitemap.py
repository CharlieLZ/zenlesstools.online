#!/usr/bin/env python3
"""Fail when the static sitemap points at missing or non-canonical pages."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://zenlesstools.online"
SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"


class HeadParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonicals: list[str] = []
        self.robots: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name.lower(): value or "" for name, value in attrs}
        if tag.lower() == "link" and "canonical" in attributes.get("rel", "").lower().split():
            self.canonicals.append(attributes.get("href", "").strip())
        if tag.lower() == "meta" and attributes.get("name", "").lower() == "robots":
            self.robots.append(attributes.get("content", "").strip().lower())


def url_to_file(url: str) -> Path | None:
    parsed = urlparse(url)
    if f"{parsed.scheme}://{parsed.netloc}" != ORIGIN or parsed.query or parsed.fragment:
        return None
    relative = parsed.path.lstrip("/")
    if not relative:
        relative = "index.html"
    elif relative.endswith("/"):
        relative += "index.html"
    return ROOT / relative


def main() -> int:
    errors: list[str] = []
    robots_path = ROOT / "robots.txt"
    sitemap_path = ROOT / "sitemap.xml"
    if not robots_path.is_file() or not sitemap_path.is_file():
        print("Missing robots.txt or sitemap.xml", file=sys.stderr)
        return 1

    declarations = [
        line.strip()
        for line in robots_path.read_text(encoding="utf-8").splitlines()
        if line.lower().startswith("sitemap:")
    ]
    expected_declaration = f"Sitemap: {ORIGIN}/sitemap.xml"
    if declarations != [expected_declaration]:
        errors.append(f"robots.txt expected exactly {expected_declaration!r}, got {declarations!r}")

    try:
        root = ElementTree.parse(sitemap_path).getroot()
    except ElementTree.ParseError as exc:
        print(f"Invalid sitemap XML: {exc}", file=sys.stderr)
        return 1
    if root.tag != f"{{{SITEMAP_NAMESPACE}}}urlset":
        errors.append(f"Unexpected sitemap root: {root.tag}")

    locations = [
        (node.findtext(f"{{{SITEMAP_NAMESPACE}}}loc") or "").strip()
        for node in root.findall(f"{{{SITEMAP_NAMESPACE}}}url")
    ]
    if not locations or len(locations) != len(set(locations)):
        errors.append("Sitemap must contain at least one URL and no duplicates")

    for location in locations:
        target = url_to_file(location)
        if target is None:
            errors.append(f"URL is not a clean same-origin URL: {location}")
            continue
        if not target.is_file():
            errors.append(f"URL has no static target: {location}")
            continue
        parser = HeadParser()
        parser.feed(target.read_text(encoding="utf-8", errors="ignore"))
        if parser.canonicals != [location]:
            errors.append(f"{target.relative_to(ROOT)} canonical mismatch: {parser.canonicals!r}")
        if any("noindex" in value for value in parser.robots):
            errors.append(f"{target.relative_to(ROOT)} is noindex but appears in sitemap")

    if errors:
        print("Sitemap verification failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"Sitemap verification passed: {len(locations)} canonical URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
