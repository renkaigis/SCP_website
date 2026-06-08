#!/usr/bin/env python3
from __future__ import annotations

import csv
import argparse
import hashlib
import html
import json
import mimetypes
import os
import re
import sys
import time
from collections import deque
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, unquote, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen


BASE_URL = "https://isscpi.com/"
SITE_HOSTS = {"isscpi.com", "www.isscpi.com"}
START_URLS = [
    BASE_URL,
    "https://isscpi.com/robots.txt",
    "https://isscpi.com/sitemap.xml",
    "https://isscpi.com/news-sitemap.xml",
    "https://isscpi.com/feed/",
    "https://isscpi.com/comments/feed/",
]
USER_AGENT = "isscpi-public-backup/1.0 (+local archive)"
MAX_URLS = 20000
REQUEST_TIMEOUT = 8
MAX_READ_SECONDS = 12
PAUSE_SECONDS = 0

TEXT_TYPES = (
    "text/html",
    "text/css",
    "text/xml",
    "application/xml",
    "application/rss+xml",
    "application/atom+xml",
    "application/json",
    "application/javascript",
    "text/javascript",
)

STATIC_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".avif",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".zip",
    ".rar",
    ".7z",
    ".mp3",
    ".mp4",
    ".mov",
    ".webm",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".css",
    ".js",
    ".json",
    ".xml",
    ".txt",
    ".csv",
}

SKIP_PATH_PREFIXES = (
    "/wp-admin/",
    "/wp-login.php",
    "/cart/",
    "/checkout/",
    "/my-account/",
)

SKIP_QUERY_KEYS = {
    "add-to-cart",
    "replytocom",
    "share",
    "like_comment",
    "preview",
    "customize_changeset_uuid",
}

URL_RE = re.compile(
    r"""(?ix)
    (?:
        https?://[^\s"'<>\\)]+
        |//[^\s"'<>\\)]+
        |/(?:wp-content|wp-includes|feed|comments/feed|sitemap|image-sitemap|news-sitemap|[^ "'<>\\)]*\.(?:jpg|jpeg|png|gif|webp|svg|ico|avif|pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp3|mp4|mov|webm|css|js|json|xml|txt|csv))[^\s"'<>\\)]*
    )
    """
)

CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", re.IGNORECASE)
SRCSET_SPLIT_RE = re.compile(r"\s*,\s*")


@dataclass
class FetchRecord:
    url: str
    local_path: str
    status: int
    content_type: str
    bytes: int
    sha256: str
    source: str
    final_url: str


@dataclass
class FailureRecord:
    url: str
    error: str
    source: str


class LinkExtractor(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {k.lower(): v for k, v in attrs if v}
        for name, value in attr_map.items():
            if name in {
                "href",
                "src",
                "action",
                "poster",
                "data-src",
                "data-lazy-src",
                "data-original",
                "data-bg",
                "data-background",
                "data-url",
                "content",
            }:
                self.add(value)
            elif name in {"srcset", "data-srcset", "imagesrcset"}:
                for src in SRCSET_SPLIT_RE.split(value):
                    part = src.strip().split()
                    if part:
                        self.add(part[0])
            elif name == "style":
                for css_url in extract_css_urls(value):
                    self.add(css_url)

    def handle_data(self, data: str) -> None:
        for match in URL_RE.findall(data):
            self.add(match)

    def add(self, value: str) -> None:
        value = html.unescape(value).strip()
        if value:
            self.links.append(urljoin(self.base_url, value))


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def canonicalize(raw_url: str, base_url: str | None = None) -> str | None:
    if not raw_url:
        return None
    raw_url = html.unescape(raw_url).strip()
    if raw_url.startswith(("mailto:", "tel:", "javascript:", "data:", "blob:", "#")):
        return None
    if base_url:
        raw_url = urljoin(base_url, raw_url)
    parsed = urlparse(raw_url)
    if parsed.scheme == "":
        parsed = urlparse(urljoin(BASE_URL, raw_url))
    if parsed.scheme not in {"http", "https"}:
        return None
    host = parsed.netloc.lower()
    if host.endswith(":443"):
        host = host[:-4]
    path = quote(unquote(parsed.path or "/"), safe="/:@~!$&'()*+,;=-._")
    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in SKIP_QUERY_KEYS and not k.lower().startswith("utm_")
    ]
    query = urlencode(query_pairs, doseq=True)
    return urlunparse((parsed.scheme.lower(), host, path, "", query, ""))


def is_same_site(url: str) -> bool:
    return urlparse(url).netloc.lower() in SITE_HOSTS


def is_wordpress_image_cdn(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return host in {"i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com"} and "isscpi.com/" in parsed.path


def should_fetch(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    if not (is_same_site(url) or is_wordpress_image_cdn(url)):
        return False
    if is_same_site(url) and (parsed.path == "/wp-json" or parsed.path.startswith("/wp-json/")):
        return False
    if is_same_site(url) and parsed.path.startswith(SKIP_PATH_PREFIXES):
        return False
    if any(k.lower() in SKIP_QUERY_KEYS for k, _ in parse_qsl(parsed.query, keep_blank_values=True)):
        return False
    return True


def should_parse(url: str, content_type: str) -> bool:
    if not (is_same_site(url) and any(content_type.startswith(t) for t in TEXT_TYPES)):
        return False
    return True


def decode_bytes(data: bytes, content_type: str) -> str:
    charset = "utf-8"
    match = re.search(r"charset=([\w.-]+)", content_type, re.IGNORECASE)
    if match:
        charset = match.group(1)
    return data.decode(charset, errors="replace")


def extract_css_urls(text: str) -> list[str]:
    urls = []
    for _, value in CSS_URL_RE.findall(text):
        value = value.strip()
        if value and not value.lower().startswith("data:"):
            urls.append(value)
    return urls


def extract_links(url: str, data: bytes, content_type: str) -> list[str]:
    text = decode_bytes(data, content_type)
    links: list[str] = []

    if content_type.startswith("text/html"):
        parser = LinkExtractor(url)
        parser.feed(text)
        links.extend(parser.links)

    if "css" in content_type:
        links.extend(urljoin(url, item) for item in extract_css_urls(text))

    for match in URL_RE.findall(text):
        links.append(urljoin(url, match))

    out: list[str] = []
    for item in links:
        normalized = canonicalize(item, url)
        if normalized:
            out.append(normalized)
    return out


def extension_from_content_type(content_type: str) -> str:
    ctype = content_type.split(";", 1)[0].strip().lower()
    if ctype == "text/html":
        return ".html"
    if ctype in {"text/xml", "application/xml", "application/rss+xml", "application/atom+xml"}:
        return ".xml"
    if ctype in {"application/javascript", "text/javascript"}:
        return ".js"
    guessed = mimetypes.guess_extension(ctype) or ""
    if guessed == ".jpe":
        return ".jpg"
    return guessed


def safe_segment(segment: str) -> str:
    segment = unquote(segment)
    segment = segment.strip() or "_"
    return re.sub(r"[^A-Za-z0-9._~!$&'()+,;=@%-]+", "_", segment)


def local_path_for(url: str, content_type: str, root: Path) -> Path:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path or "/"
    segments = [safe_segment(seg) for seg in path.split("/") if seg]
    ext = Path(segments[-1]).suffix.lower() if segments else ""
    wanted_ext = extension_from_content_type(content_type)

    if not segments or path.endswith("/"):
        segments.append("index")
        ext = ""

    if not ext and wanted_ext:
        segments[-1] += wanted_ext
    elif content_type.startswith("text/html") and ext not in {".html", ".htm"}:
        segments.append("index.html")

    if parsed.query:
        digest = hashlib.sha1(parsed.query.encode("utf-8")).hexdigest()[:12]
        stem = Path(segments[-1]).stem
        suffix = Path(segments[-1]).suffix
        segments[-1] = f"{stem}__q_{digest}{suffix}"

    return root / "site" / host / Path(*segments)


def request_url(url: str) -> tuple[int, str, bytes, str]:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(req, timeout=REQUEST_TIMEOUT) as response:
        chunks: list[bytes] = []
        started = time.monotonic()
        while True:
            if time.monotonic() - started > MAX_READ_SECONDS:
                raise TimeoutError(f"Exceeded {MAX_READ_SECONDS}s total read time")
            chunk = response.read(65536)
            if not chunk:
                break
            chunks.append(chunk)
        data = b"".join(chunks)
        status = getattr(response, "status", 200)
        content_type = response.headers.get("Content-Type", "application/octet-stream").split("\n", 1)[0]
        final_url = response.geturl()
        return status, content_type, data, final_url


def guessed_content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".html", ".htm"}:
        return "text/html"
    if suffix == ".xml":
        return "application/xml"
    if suffix == ".json":
        return "application/json"
    if suffix == ".css":
        return "text/css"
    if suffix == ".js":
        return "application/javascript"
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def existing_path_candidates(url: str, root: Path) -> list[Path]:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path or "/"
    segments = [safe_segment(seg) for seg in path.split("/") if seg]
    candidates: list[list[str]] = []

    if not segments or path.endswith("/"):
        base = segments + ["index"]
        candidates.extend([base[:-1] + ["index.html"], base[:-1] + ["index.xml"], base[:-1] + ["index.json"]])
    else:
        suffix = Path(segments[-1]).suffix
        if suffix:
            candidates.append(segments)
        else:
            candidates.extend([segments + ["index.html"], segments + ["index.xml"], [*segments[:-1], f"{segments[-1]}.html"]])

    out: list[Path] = []
    for parts in candidates:
        parts = parts[:]
        if parsed.query:
            digest = hashlib.sha1(parsed.query.encode("utf-8")).hexdigest()[:12]
            stem = Path(parts[-1]).stem
            suffix = Path(parts[-1]).suffix
            parts[-1] = f"{stem}__q_{digest}{suffix}"
        out.append(root / "site" / host / Path(*parts))
    return out


def read_existing(url: str, root: Path) -> tuple[str, bytes, Path] | None:
    for candidate in existing_path_candidates(url, root):
        if candidate.exists() and candidate.is_file():
            return guessed_content_type(candidate), candidate.read_bytes(), candidate
    return None


def save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def queue_url(queue: deque[tuple[str, str]], seen_or_queued: set[str], raw_url: str, source: str) -> None:
    url = canonicalize(raw_url)
    if not url or url in seen_or_queued or not should_fetch(url):
        return
    seen_or_queued.add(url)
    queue.append((url, source))


def extract_urls_from_json_obj(obj: object) -> Iterable[str]:
    if isinstance(obj, dict):
        for value in obj.values():
            yield from extract_urls_from_json_obj(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from extract_urls_from_json_obj(value)
    elif isinstance(obj, str):
        for match in URL_RE.findall(obj):
            yield match
        if obj.startswith(("http://", "https://", "/")):
            yield obj


def fetch_json(url: str) -> tuple[object | None, dict[str, str], bytes | None, str | None]:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as response:
            data = response.read()
            headers = {k.lower(): v for k, v in response.headers.items()}
            return json.loads(data.decode("utf-8", errors="replace")), headers, data, response.geturl()
    except Exception as exc:
        return None, {}, None, str(exc)


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def collect_rest_api(root: Path, queue: deque[tuple[str, str]], seen_or_queued: set[str]) -> list[dict[str, object]]:
    api_root = root / "metadata" / "wp-json"
    api_index: list[dict[str, object]] = []

    def save_endpoint(url: str, rel_path: str, source: str) -> object | None:
        obj, headers, raw, err = fetch_json(url)
        record: dict[str, object] = {"url": url, "path": rel_path, "source": source}
        if obj is None or raw is None:
            record["error"] = err
            api_index.append(record)
            return None
        save_bytes(api_root / rel_path, raw)
        record["bytes"] = len(raw)
        record["x_wp_total"] = headers.get("x-wp-total")
        record["x_wp_totalpages"] = headers.get("x-wp-totalpages")
        api_index.append(record)
        for found in extract_urls_from_json_obj(obj):
            queue_url(queue, seen_or_queued, found, f"api:{rel_path}")
        return obj

    root_obj = save_endpoint("https://isscpi.com/wp-json/", "root.json", "api-root")
    save_endpoint("https://isscpi.com/wp-json/wp/v2/types", "wp-v2-types.json", "api-types")
    save_endpoint("https://isscpi.com/wp-json/wp/v2/taxonomies", "wp-v2-taxonomies.json", "api-taxonomies")
    save_endpoint("https://isscpi.com/wp-json/wp/v2/menu-locations", "wp-v2-menu-locations.json", "api-menu-locations")

    collection_bases = {
        "posts",
        "pages",
        "media",
        "categories",
        "tags",
        "comments",
        "product",
        "product_cat",
        "product_tag",
        "navigation",
        "blocks",
        "jetpack-testimonial",
        "jp_pay_product",
    }

    for base in sorted(collection_bases):
        if not base:
            continue
        page = 1
        while page <= 200:
            endpoint = f"https://isscpi.com/wp-json/wp/v2/{base}?per_page=100&page={page}&_embed=1"
            obj, headers, raw, err = fetch_json(endpoint)
            if obj is None and "_embed=1" in endpoint:
                endpoint = f"https://isscpi.com/wp-json/wp/v2/{base}?per_page=100&page={page}"
                obj, headers, raw, err = fetch_json(endpoint)
            rel_path = f"collections/{base}/page-{page:03d}.json"
            if obj is None or raw is None:
                if page == 1:
                    api_index.append({"url": endpoint, "path": rel_path, "source": f"api-collection:{base}", "error": err})
                break
            save_bytes(api_root / rel_path, raw)
            api_index.append(
                {
                    "url": endpoint,
                    "path": rel_path,
                    "source": f"api-collection:{base}",
                    "bytes": len(raw),
                    "x_wp_total": headers.get("x-wp-total"),
                    "x_wp_totalpages": headers.get("x-wp-totalpages"),
                }
            )
            for found in extract_urls_from_json_obj(obj):
                queue_url(queue, seen_or_queued, found, f"api:{base}:page-{page}")
            total_pages = int(headers.get("x-wp-totalpages") or "1")
            if page >= total_pages:
                break
            page += 1
            time.sleep(PAUSE_SECONDS)

    for base in ("products", "products/categories", "products/tags"):
        page = 1
        while page <= 200:
            endpoint = f"https://isscpi.com/wp-json/wc/store/v1/{base}?per_page=100&page={page}"
            obj, headers, raw, err = fetch_json(endpoint)
            rel_path = f"wc-store/{base.replace('/', '-')}/page-{page:03d}.json"
            if obj is None or raw is None:
                if page == 1:
                    api_index.append({"url": endpoint, "path": rel_path, "source": f"api-wc-store:{base}", "error": err})
                break
            save_bytes(api_root / rel_path, raw)
            api_index.append(
                {
                    "url": endpoint,
                    "path": rel_path,
                    "source": f"api-wc-store:{base}",
                    "bytes": len(raw),
                    "x_wp_total": headers.get("x-wp-total"),
                    "x_wp_totalpages": headers.get("x-wp-totalpages"),
                }
            )
            for found in extract_urls_from_json_obj(obj):
                queue_url(queue, seen_or_queued, found, f"api:wc-store:{base}:page-{page}")
            total_pages = int(headers.get("x-wp-totalpages") or "1")
            if page >= total_pages:
                break
            page += 1
            time.sleep(PAUSE_SECONDS)

    write_json(root / "metadata" / "wp-json-index.json", api_index)
    return api_index


def crawl(root: Path) -> tuple[list[FetchRecord], list[FailureRecord], set[str]]:
    queue: deque[tuple[str, str]] = deque()
    seen_or_queued: set[str] = set()
    fetched: set[str] = set()
    records: list[FetchRecord] = []
    failures: list[FailureRecord] = []
    external_urls: set[str] = set()

    for url in START_URLS:
        queue_url(queue, seen_or_queued, url, "seed")

    print(f"[{now_iso()}] Collecting public WordPress REST API data...")
    collect_rest_api(root, queue, seen_or_queued)

    while queue and len(fetched) < MAX_URLS:
        url, source = queue.popleft()
        if url in fetched:
            continue
        fetched.add(url)
        try:
            existing = read_existing(url, root)
            if existing:
                content_type, data, local_path = existing
                status = 200
                normalized_final = url
            else:
                status, content_type, data, final_url = request_url(url)
                normalized_final = canonicalize(final_url) or final_url
                local_path = local_path_for(url, content_type, root)
                save_bytes(local_path, data)
            digest = hashlib.sha256(data).hexdigest()
            records.append(
                FetchRecord(
                    url=url,
                    local_path=str(local_path.relative_to(root)),
                    status=status,
                    content_type=content_type,
                    bytes=len(data),
                    sha256=digest,
                    source=source,
                    final_url=normalized_final,
                )
            )
            if len(records) % 50 == 0:
                print(f"[{now_iso()}] Downloaded {len(records)} URLs; queued {len(queue)}")
            if should_parse(url, content_type):
                for link in extract_links(url, data, content_type):
                    if should_fetch(link):
                        queue_url(queue, seen_or_queued, link, url)
                    elif urlparse(link).scheme in {"http", "https"}:
                        external_urls.add(link)
        except HTTPError as exc:
            failures.append(FailureRecord(url=url, error=f"HTTP {exc.code}: {exc.reason}", source=source))
        except (URLError, TimeoutError, OSError) as exc:
            failures.append(FailureRecord(url=url, error=str(exc), source=source))
        time.sleep(PAUSE_SECONDS)

    metadata = root / "metadata"
    metadata.mkdir(parents=True, exist_ok=True)

    with (metadata / "urls.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(records[0]).keys()) if records else [f.name for f in FetchRecord.__dataclass_fields__.values()])
        writer.writeheader()
        for record in records:
            writer.writerow(asdict(record))

    with (metadata / "failures.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[f.name for f in FailureRecord.__dataclass_fields__.values()])
        writer.writeheader()
        for failure in failures:
            writer.writerow(asdict(failure))

    (metadata / "external-urls.txt").write_text("\n".join(sorted(external_urls)) + ("\n" if external_urls else ""), encoding="utf-8")

    return records, failures, external_urls


def main() -> int:
    parser = argparse.ArgumentParser(description="Back up the public isscpi.com website.")
    parser.add_argument("--output-root", help="Existing or new backup directory. Existing files will be reused.")
    args = parser.parse_args()

    if args.output_root:
        out_root = Path(args.output_root).expanduser().resolve()
        out_root.mkdir(parents=True, exist_ok=True)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_root = Path.cwd() / "backups" / f"isscpi_public_backup_{timestamp}"
        out_root.mkdir(parents=True, exist_ok=False)

    started = now_iso()
    records, failures, external_urls = crawl(out_root)
    finished = now_iso()

    total_bytes = sum(record.bytes for record in records)
    by_type: dict[str, int] = {}
    for record in records:
        ctype = record.content_type.split(";", 1)[0].lower()
        by_type[ctype] = by_type.get(ctype, 0) + 1

    manifest = {
        "site": BASE_URL,
        "backup_type": "public crawl plus public WordPress REST API export",
        "started": started,
        "finished": finished,
        "output_root": str(out_root),
        "downloaded_url_count": len(records),
        "failure_count": len(failures),
        "external_reference_count": len(external_urls),
        "total_bytes": total_bytes,
        "content_types": dict(sorted(by_type.items(), key=lambda item: (-item[1], item[0]))),
        "notes": [
            "This backup contains public pages, public media/files, public same-site assets, sitemaps, feeds, and public WordPress REST API collection JSON.",
            "It does not contain the private WordPress database, admin-only media, plugin/theme source not publicly linked, orders, form submissions, users, or server configuration.",
        ],
    }
    write_json(out_root / "manifest.json", manifest)

    summary = [
        "ISSCPI public website backup",
        f"Site: {BASE_URL}",
        f"Started: {started}",
        f"Finished: {finished}",
        f"Downloaded URLs: {len(records)}",
        f"Failures: {len(failures)}",
        f"External references recorded: {len(external_urls)}",
        f"Total downloaded bytes: {total_bytes}",
        "",
        "Important limitation:",
        "This is a public crawl backup. For a restorable WordPress migration, also export the database and wp-content from the hosting/admin panel.",
        "",
        "Key files:",
        "- manifest.json",
        "- metadata/urls.csv",
        "- metadata/failures.csv",
        "- metadata/external-urls.txt",
        "- metadata/wp-json/",
        "- site/",
    ]
    (out_root / "README.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
