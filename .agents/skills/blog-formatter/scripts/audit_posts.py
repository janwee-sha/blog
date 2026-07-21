#!/usr/bin/env python3
"""Read-only deterministic preflight for Astro blog posts."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import unquote, urlsplit


POST_SUFFIXES = {".md", ".mdx"}
HAN = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff"
BOUNDARY_RE = re.compile(rf"(?<=[{HAN}])(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])(?=[{HAN}])")
HEADING_RE = re.compile(r"^(#{1,6})(?:[ \t]+)(.+?)\s*$")
FENCE_RE = re.compile(r"^[ \t]{0,3}(`{3,}|~{3,})(.*)$")
LINK_RE = re.compile(r"!?\[[^\]\n]*\]\(([^)\n]+)\)")
HTML_LINK_RE = re.compile(r"\b(?:href|src)\s*=\s*([\"'])(.*?)\1", re.IGNORECASE)
URL_RE = re.compile(r"https?://[^\s<>()\[\]{}\"']+")
AUTOLINK_RE = re.compile(r"<(https?://[^ >]+)>")
EPIGRAPH_QUOTE_RE = re.compile(r"> \S(?:.*\S)?$")
EPIGRAPH_ATTRIBUTION_RE = re.compile(r"> ——《[^《》]+》$")
CHAPTER_RE = re.compile(r"(\d{2})\. (\S.*)$")
SUBSECTION_RE = re.compile(r"(\d+)\.(\d+)\. (\S.*)$")
REFERENCE_ENTRY_RE = re.compile(r"(\d+)\.  (\S.*)$")
BOOK_REFERENCE_RE = re.compile(r"《[^《》]+》（[^（）]+ 著，[^（）]+）$")


@dataclass(frozen=True)
class Diagnostic:
    severity: str
    code: str
    file: str
    line: int
    message: str


def is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def all_posts(posts_root: Path) -> list[Path]:
    return sorted(
        path.resolve()
        for path in posts_root.rglob("*")
        if path.is_file() and path.suffix.lower() in POST_SUFFIXES
    )


def resolve_scope(root: Path, scope: str) -> list[Path]:
    posts_root = (root / "src/content/posts").resolve()
    if not posts_root.is_dir():
        raise ValueError(f"posts directory not found: {posts_root}")

    posts = all_posts(posts_root)
    if scope == "all":
        if not posts:
            raise ValueError("no Markdown or MDX posts found")
        return posts

    raw = Path(scope)
    direct_candidates = []
    if raw.is_absolute():
        direct_candidates.append(raw)
    else:
        direct_candidates.extend((root / raw, posts_root / raw))

    expanded = []
    for candidate in direct_candidates:
        expanded.append(candidate)
        if candidate.suffix.lower() not in POST_SUFFIXES:
            expanded.extend((candidate.with_suffix(".md"), candidate.with_suffix(".mdx")))

    direct_matches = []
    for candidate in expanded:
        resolved = candidate.resolve()
        if (
            resolved.is_file()
            and resolved.suffix.lower() in POST_SUFFIXES
            and is_within(resolved, posts_root)
        ):
            direct_matches.append(resolved)

    direct_matches = sorted(set(direct_matches))
    if len(direct_matches) == 1:
        return direct_matches
    if len(direct_matches) > 1:
        raise ValueError(f"scope is ambiguous: {scope}")

    normalized = scope.removeprefix("src/content/posts/").replace("\\", "/")
    normalized = re.sub(r"\.mdx?$", "", normalized, flags=re.IGNORECASE).strip("/")
    slug_matches = [
        post
        for post in posts
        if post.relative_to(posts_root).with_suffix("").as_posix() == normalized
        or post.stem == normalized
    ]
    if len(slug_matches) == 1:
        return slug_matches
    if len(slug_matches) > 1:
        choices = ", ".join(path.relative_to(root).as_posix() for path in slug_matches)
        raise ValueError(f"scope is ambiguous; use a repo-relative path: {choices}")
    raise ValueError(f"post not found for scope: {scope}")


def add(
    diagnostics: list[Diagnostic],
    severity: str,
    code: str,
    relative: str,
    line: int,
    message: str,
) -> None:
    diagnostics.append(Diagnostic(severity, code, relative, line, message))


def split_frontmatter(lines: list[str]) -> tuple[int, list[str]]:
    if not lines or lines[0].rstrip("\r\n") != "---":
        return 0, []
    for index in range(1, len(lines)):
        if lines[index].rstrip("\r\n") == "---":
            return index + 1, lines[1:index]
    return 0, []


def parse_frontmatter(
    frontmatter: list[str], relative: str, diagnostics: list[Diagnostic]
) -> dict[str, tuple[str, int]]:
    fields: dict[str, tuple[str, int]] = {}
    for offset, raw_line in enumerate(frontmatter, start=2):
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        match = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]*(.*))?$", raw_line.rstrip("\r\n"))
        if not match:
            continue
        key, value = match.group(1), match.group(2) or ""
        if key in fields:
            add(diagnostics, "error", "duplicate-frontmatter-key", relative, offset, f"duplicate frontmatter key: {key}")
        fields[key] = (value.strip(), offset)
    return fields


def unquote_scalar(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def recent_posts(root: Path, count: int) -> list[dict[str, str]]:
    if count < 1:
        raise ValueError("recent post count must be at least 1")

    posts_root = (root / "src/content/posts").resolve()
    if not posts_root.is_dir():
        raise ValueError(f"posts directory not found: {posts_root}")

    summaries: list[dict[str, str]] = []
    for post in all_posts(posts_root):
        relative = post.relative_to(root).as_posix()
        try:
            source = post.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"post is not valid UTF-8: {relative}") from error

        _, frontmatter = split_frontmatter(source.splitlines(keepends=True))
        fields = parse_frontmatter(frontmatter, relative, [])
        published = unquote_scalar(fields.get("published", ("", 0))[0]).strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", published):
            raise ValueError(f"post has no valid YYYY-MM-DD published date: {relative}")

        summaries.append(
            {
                "scope": post.relative_to(posts_root).with_suffix("").as_posix(),
                "file": relative,
                "title": unquote_scalar(fields.get("title", (post.stem, 0))[0]).strip(),
                "published": published,
                "updated": unquote_scalar(fields.get("updated", ("", 0))[0]).strip(),
            }
        )

    if not summaries:
        raise ValueError("no Markdown or MDX posts found")
    summaries.sort(key=lambda item: (item["published"], item["scope"]), reverse=True)
    return summaries[:count]


def mask_prose(line: str) -> str:
    masked = line
    masked = re.sub(r"`+[^`]*`+", lambda match: " " * len(match.group(0)), masked)
    masked = re.sub(r"\]\([^)]*\)", lambda match: " " * len(match.group(0)), masked)
    masked = re.sub(r"<[^>]+>", lambda match: " " * len(match.group(0)), masked)
    masked = URL_RE.sub(lambda match: " " * len(match.group(0)), masked)
    return masked


def normalize_heading(value: str) -> str:
    value = re.sub(r"`+([^`]*)`+", r"\1", value)
    value = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"[*_~]", "", value)
    return re.sub(r"\s+", " ", value).strip().casefold()


def markdown_destination(raw: str) -> str:
    value = raw.strip()
    if value.startswith("<") and ">" in value:
        return value[1 : value.index(">")]
    match = re.match(r"([^\s]+)(?:\s+['\"(].*)?$", value)
    return match.group(1) if match else value


def inspect_local_target(
    destination: str,
    post: Path,
    root: Path,
    relative: str,
    line_number: int,
    diagnostics: list[Diagnostic],
) -> None:
    if not destination or destination.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return
    parsed = urlsplit(destination)
    if parsed.scheme in {"http", "https"} or parsed.netloc:
        return
    try:
        decoded = unquote(parsed.path)
    except Exception:
        add(diagnostics, "error", "invalid-link-encoding", relative, line_number, f"invalid encoded link: {destination}")
        return
    if not decoded:
        return

    if decoded.startswith("/"):
        if Path(decoded).suffix or decoded.startswith("/uploads/"):
            target = (root / "public" / decoded.lstrip("/")).resolve()
            public_root = (root / "public").resolve()
            if not is_within(target, public_root) or not target.exists():
                add(diagnostics, "error", "missing-local-target", relative, line_number, f"local public target does not exist: {destination}")
        return

    target = (post.parent / decoded).resolve()
    if not is_within(target, root):
        add(diagnostics, "error", "escaping-local-target", relative, line_number, f"local target escapes the repository: {destination}")
    elif (Path(decoded).suffix or decoded.startswith(".")) and not target.exists():
        add(diagnostics, "error", "missing-local-target", relative, line_number, f"relative target does not exist: {destination}")


def inspect_canonical_structure(
    lines: list[str],
    body_start: int,
    headings: list[tuple[int, int, str]],
    relative: str,
    diagnostics: list[Diagnostic],
) -> None:
    first_body_index = body_start
    while first_body_index < len(lines) and not lines[first_body_index].strip():
        first_body_index += 1

    epigraph_line = min(first_body_index + 1, max(len(lines), 1))
    epigraph = [
        lines[offset].rstrip("\r\n") if offset < len(lines) else ""
        for offset in range(first_body_index, first_body_index + 3)
    ]
    if not epigraph[0].startswith(">"):
        add(
            diagnostics,
            "warning",
            "missing-opening-epigraph",
            relative,
            epigraph_line,
            "body should open with a sourced classical quotation before the first chapter",
        )
    elif not (
        EPIGRAPH_QUOTE_RE.fullmatch(epigraph[0])
        and epigraph[1] == ">"
        and EPIGRAPH_ATTRIBUTION_RE.fullmatch(epigraph[2])
    ):
        add(
            diagnostics,
            "warning",
            "invalid-opening-epigraph",
            relative,
            epigraph_line,
            "opening epigraph should be `> 名句`, `>`, then `> ——《典籍·篇名》`",
        )

    body_headings = [heading for heading in headings if heading[1] >= body_start + 1]
    for level, line_number, title in body_headings:
        if level not in {2, 3}:
            add(
                diagnostics,
                "warning",
                "noncanonical-heading-level",
                relative,
                line_number,
                f"canonical body structure uses H2 chapters and H3 subsections, found H{level}: {title}",
            )

    h2_headings = [heading for heading in body_headings if heading[0] == 2]
    numbered_chapters: list[tuple[int, int, str]] = []
    reference_heading: tuple[int, int, str] | None = None
    expected_chapter = 1
    for heading in h2_headings:
        _, line_number, title = heading
        if title == "引用":
            reference_heading = heading
            continue
        match = CHAPTER_RE.fullmatch(title)
        if not match:
            add(
                diagnostics,
                "warning",
                "invalid-chapter-heading",
                relative,
                line_number,
                "H2 chapter should use `## NN. 标题`; reserve unnumbered `## 引用` for references",
            )
            continue
        chapter_number = int(match.group(1))
        numbered_chapters.append((chapter_number, line_number, match.group(2)))
        if chapter_number != expected_chapter:
            add(
                diagnostics,
                "warning",
                "nonconsecutive-chapter-number",
                relative,
                line_number,
                f"expected chapter {expected_chapter:02d}, found {chapter_number:02d}",
            )
        expected_chapter = chapter_number + 1

    if not numbered_chapters:
        add(
            diagnostics,
            "warning",
            "missing-numbered-chapters",
            relative,
            body_start + 1,
            "body should contain consecutively numbered H2 chapters",
        )
    else:
        first_number, first_line, first_title = numbered_chapters[0]
        if first_number != 1 or first_title != "引言":
            add(
                diagnostics,
                "warning",
                "invalid-opening-chapter",
                relative,
                first_line,
                "first chapter should be `## 01. 引言`",
            )

    current_chapter: int | None = None
    expected_subsection = 1
    for level, line_number, title in body_headings:
        if level == 2:
            match = CHAPTER_RE.fullmatch(title)
            current_chapter = int(match.group(1)) if match else None
            expected_subsection = 1
            continue
        if level != 3:
            continue
        match = SUBSECTION_RE.fullmatch(title)
        if not match or current_chapter is None:
            add(
                diagnostics,
                "warning",
                "invalid-subsection-heading",
                relative,
                line_number,
                "H3 subsection should use `### N.M. 标题` under a numbered H2 chapter",
            )
            continue
        parent_number = int(match.group(1))
        subsection_number = int(match.group(2))
        if parent_number != current_chapter or subsection_number != expected_subsection:
            add(
                diagnostics,
                "warning",
                "nonconsecutive-subsection-number",
                relative,
                line_number,
                f"expected subsection {current_chapter}.{expected_subsection}, found {parent_number}.{subsection_number}",
            )
        expected_subsection = subsection_number + 1

    if reference_heading is None:
        return

    reference_line = reference_heading[1]
    if not h2_headings or h2_headings[-1][1] != reference_line:
        add(
            diagnostics,
            "warning",
            "references-not-final-section",
            relative,
            reference_line,
            "`## 引用` should be the final H2 section",
        )

    reference_entries: list[tuple[int, str]] = []
    for line_number in range(reference_line + 1, len(lines) + 1):
        value = lines[line_number - 1].rstrip("\r\n")
        if value.strip():
            reference_entries.append((line_number, value))
    if not reference_entries:
        add(
            diagnostics,
            "warning",
            "empty-references-section",
            relative,
            reference_line,
            "`## 引用` should contain an ordered list of sources",
        )
        return

    expected_reference = 1
    for line_number, value in reference_entries:
        match = REFERENCE_ENTRY_RE.fullmatch(value)
        if not match:
            add(
                diagnostics,
                "warning",
                "invalid-reference-entry",
                relative,
                line_number,
                "reference should be one line in the form `1.  条目`",
            )
            continue
        reference_number = int(match.group(1))
        content = match.group(2)
        if reference_number != expected_reference:
            add(
                diagnostics,
                "warning",
                "nonconsecutive-reference-number",
                relative,
                line_number,
                f"expected reference {expected_reference}, found {reference_number}",
            )
        expected_reference = reference_number + 1
        if content.startswith("《") and not BOOK_REFERENCE_RE.fullmatch(content):
            add(
                diagnostics,
                "warning",
                "invalid-book-reference",
                relative,
                line_number,
                "book reference should use `《书名》（作者 著，出版社）`",
            )
        if content.endswith(("。", ".", "；", ";")):
            add(
                diagnostics,
                "warning",
                "reference-terminal-punctuation",
                relative,
                line_number,
                "reference entries should omit terminal punctuation",
            )


def audit_post(post: Path, root: Path) -> tuple[list[Diagnostic], set[str]]:
    relative = post.relative_to(root).as_posix()
    diagnostics: list[Diagnostic] = []
    external_urls: set[str] = set()
    try:
        source = post.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        add(diagnostics, "error", "invalid-utf8", relative, 1, "file is not valid UTF-8")
        return diagnostics, external_urls

    lines = source.splitlines(keepends=True)
    if source and not source.endswith("\n"):
        add(diagnostics, "warning", "missing-final-newline", relative, len(lines), "file has no final newline")
    if "\r\n" in source:
        add(diagnostics, "warning", "crlf", relative, 1, "file uses CRLF line endings")

    body_start, frontmatter = split_frontmatter(lines)
    if not frontmatter:
        add(diagnostics, "error", "invalid-frontmatter", relative, 1, "missing or unclosed opening YAML frontmatter")
        body_start = 0
        fields = {}
    else:
        fields = parse_frontmatter(frontmatter, relative, diagnostics)
        for required in ("title", "published", "draft"):
            if required not in fields or not unquote_scalar(fields[required][0]).strip():
                add(diagnostics, "error", "missing-frontmatter-field", relative, 1, f"missing required frontmatter field: {required}")
        if "published" in fields and not re.fullmatch(r"['\"]?\d{4}-\d{2}-\d{2}['\"]?", fields["published"][0]):
            add(diagnostics, "warning", "non-iso-published-date", relative, fields["published"][1], "published should use YYYY-MM-DD")
        if "updated" in fields and not re.fullmatch(r"['\"]?\d{4}-\d{2}-\d{2}['\"]?", fields["updated"][0]):
            add(diagnostics, "warning", "non-iso-updated-date", relative, fields["updated"][1], "updated should use YYYY-MM-DD")
        if "draft" in fields and fields["draft"][0] not in {"true", "false"}:
            add(diagnostics, "error", "invalid-draft", relative, fields["draft"][1], "draft must be an unquoted boolean")

    headings: dict[str, int] = {}
    structural_headings: list[tuple[int, int, str]] = []
    previous_level = 0
    open_fence: tuple[str, int] | None = None

    for index, raw_line in enumerate(lines[body_start:], start=body_start + 1):
        line = raw_line.rstrip("\r\n")
        fence = FENCE_RE.match(line)
        if fence:
            marker = fence.group(1)
            marker_char = marker[0]
            if open_fence is None:
                open_fence = (marker, index)
                if not fence.group(2).strip():
                    add(diagnostics, "info", "missing-code-language", relative, index, "fenced code block has no language identifier")
            elif marker_char == open_fence[0][0] and len(marker) >= len(open_fence[0]):
                open_fence = None
            continue
        if open_fence is not None:
            continue

        if line.endswith(" ") or line.endswith("\t"):
            trailing = re.search(r"[ \t]+$", line)
            if trailing and trailing.group(0) != "  ":
                add(diagnostics, "warning", "trailing-whitespace", relative, index, "trailing whitespace outside a code fence")
        if "\t" in line:
            add(diagnostics, "warning", "tab-in-prose", relative, index, "tab character outside a code fence")
        if "\u00a0" in line:
            add(diagnostics, "warning", "non-breaking-space", relative, index, "non-breaking space in source")

        heading = HEADING_RE.match(line)
        if heading:
            level = len(heading.group(1))
            structural_headings.append((level, index, heading.group(2).strip()))
            name = normalize_heading(heading.group(2))
            if previous_level and level > previous_level + 1:
                add(diagnostics, "warning", "heading-level-jump", relative, index, f"heading jumps from H{previous_level} to H{level}")
            previous_level = level
            if name in headings:
                add(diagnostics, "warning", "duplicate-heading", relative, index, f"heading duplicates line {headings[name]}")
            elif name:
                headings[name] = index

        prose = mask_prose(line)
        if BOUNDARY_RE.search(prose):
            add(diagnostics, "warning", "cjk-latin-spacing", relative, index, "Chinese text and Latin letters/digits touch in prose")

        destinations = [markdown_destination(match.group(1)) for match in LINK_RE.finditer(line)]
        destinations.extend(match.group(2).strip() for match in HTML_LINK_RE.finditer(line))
        destinations.extend(match.group(1).strip() for match in AUTOLINK_RE.finditer(line))
        for destination in destinations:
            if destination.startswith(("http://", "https://")):
                external_urls.add(destination.rstrip(".,;:!?，。；：！？"))
            else:
                inspect_local_target(destination, post, root, relative, index, diagnostics)
        bare_line = re.sub(r"`+[^`]*`+", lambda match: " " * len(match.group(0)), line)
        bare_line = LINK_RE.sub(lambda match: " " * len(match.group(0)), bare_line)
        bare_line = re.sub(r"<[^>]+>", lambda match: " " * len(match.group(0)), bare_line)
        for match in URL_RE.finditer(bare_line):
            external_urls.add(match.group(0).rstrip(".,;:!?，。；：！？"))

    if open_fence is not None:
        add(diagnostics, "error", "unclosed-code-fence", relative, open_fence[1], "fenced code block is not closed")

    if frontmatter:
        inspect_canonical_structure(lines, body_start, structural_headings, relative, diagnostics)

    image_field = fields.get("image")
    if image_field:
        image = unquote_scalar(image_field[0]).strip()
        if image:
            if image.startswith(("http://", "https://")):
                external_urls.add(image)
            else:
                inspect_local_target(image, post, root, relative, image_field[1], diagnostics)
    return diagnostics, external_urls


def render_text(files: list[Path], root: Path, diagnostics: list[Diagnostic], urls: list[str]) -> str:
    output = [f"Selected {len(files)} post(s):"]
    output.extend(f"- {path.relative_to(root).as_posix()}" for path in files)
    output.append("")
    if diagnostics:
        output.append(f"Diagnostics ({len(diagnostics)}):")
        output.extend(
            f"- {item.severity.upper()} {item.file}:{item.line} [{item.code}] {item.message}"
            for item in diagnostics
        )
    else:
        output.append("No deterministic diagnostics.")
    output.append("")
    output.append(f"External URLs ({len(urls)}; validate separately):")
    output.extend(f"- {url}" for url in urls)
    return "\n".join(output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root (default: current directory)")
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--scope", help="all, slug, filename, or repo-relative path")
    selection.add_argument("--recent", type=int, metavar="COUNT", help="list the most recently published posts")
    parser.add_argument("--format", choices=("text", "json"), default="text")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if args.recent is not None:
        try:
            posts = recent_posts(root, args.recent)
        except ValueError as error:
            print(f"error: {error}", file=sys.stderr)
            return 2

        if args.format == "json":
            payload = {"root": str(root), "recent": args.recent, "posts": posts}
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(f"Most recently published {len(posts)} post(s):")
            for post in posts:
                print(f'- {post["scope"]}: {post["title"]} ({post["published"]})')
        return 0

    try:
        files = resolve_scope(root, args.scope)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    diagnostics: list[Diagnostic] = []
    external_urls: set[str] = set()
    for post in files:
        post_diagnostics, post_urls = audit_post(post, root)
        diagnostics.extend(post_diagnostics)
        external_urls.update(post_urls)

    diagnostics.sort(key=lambda item: (item.file, item.line, item.code))
    urls = sorted(external_urls)
    if args.format == "json":
        payload = {
            "root": str(root),
            "scope": args.scope,
            "files": [path.relative_to(root).as_posix() for path in files],
            "diagnostics": [asdict(item) for item in diagnostics],
            "external_urls": urls,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(render_text(files, root, diagnostics, urls))
    return 1 if any(item.severity == "error" for item in diagnostics) else 0


if __name__ == "__main__":
    raise SystemExit(main())
