---
name: blog-formatter
description: Interactively review and fix one or all Markdown/MDX posts under src/content/posts in this Astro/Fuwari blog. Use when asked to format, proofread, lint, normalize, or validate blog posts; check Markdown and Astro frontmatter, Chinese/English spacing, typos and grammar, consistency, images and links, or publication readiness. Always inspect first, present proposed fixes and judgment-sensitive questions, wait for user feedback, then apply only the approved changes and validate them. Accept scope=all or a slug, filename, or repo-relative path.
---

# Blog Formatter

Review the requested posts against the repository's current rules, agree on the repair set with the user, then make conservative fixes and prove the result with repository checks. Treat source configuration as authoritative and preserve the author's voice.

## Input

Interpret the prompt-level `scope` input:

- `scope=all`: select every `.md` and `.mdx` file recursively under `src/content/posts/`.
- `scope=<slug|filename|repo-relative-path>`: select exactly one post. Accept values such as `langextract`, `langextract.md`, or `src/content/posts/langextract.md`.

If the prompt clearly names one post, infer that single-post scope. If it explicitly says all posts, infer `all`. Otherwise ask for `scope`; never silently expand an ambiguous request to all posts.

Do not accept or invent `check` and `fix` modes. Use the required phased workflow every time.

## Required phase gate

Treat the initial invocation as authorization to inspect, not to edit. Never modify a post, run a formatter in write mode, or apply an automated fix before presenting the findings and receiving the user's feedback. Do not interpret silence as approval.

Require at least one confirmation before applying any proposed changes. Ask targeted questions for judgment-sensitive items. If the inspection finds no actionable issues, report that the scope is clean and stop without asking for a meaningless approval.

## Phase 1: Inspect

1. Find the repository root with `git rev-parse --show-toplevel`. Require `src/content/posts/` to exist and record the initial `git status --short` output.
2. Read the repository-level `AGENTS.md`, `README.md`, `package.json`, Astro config, content collection schema, and content-validation scripts that govern the selected posts. Prefer current repository rules over examples bundled with this skill.
3. Read [references/review-checklist.md](references/review-checklist.md) completely before reviewing content.
4. Resolve and baseline the scope with the read-only preflight:

   ```bash
   python3 <skill-dir>/scripts/audit_posts.py --root <repo-root> --scope <scope> --format json
   ```

   Treat the script as a deterministic preflight, not as a complete editorial review. Refuse paths outside `src/content/posts/`, missing posts, and ambiguous slugs.
5. Read every selected post completely. Inspect the whole file when judging terminology, heading structure, numbering, punctuation, and consistency; do not infer consistency from an excerpt.
6. Check every category in the required checklist. Validate local links and deduplicated external links during this phase. Do not edit while checking.
7. Build a proposed repair set with exact file and line locations, the current text or condition, the recommended change, and the reason.

## Phase 2: Review with the user

Classify findings before asking for feedback:

- **Definite repairs**: clear, meaning-preserving defects such as malformed Markdown, missing resources, obvious typos, accidental NBSP characters, or unambiguous Chinese/English spacing. Group repetitive instances and ask for one approval for the group.
- **Needs user review**: wording or tone changes, multiple valid corrections, title/description/frontmatter changes, heading-anchor changes, fact or API updates, runnable-code changes, link replacements, publication dates, or anything that could alter meaning. Show the recommended option and concise alternatives or tradeoffs.
- **Suggestions only**: subjective improvements that are not errors. Keep them out of the repair set by default; offer them separately without assuming approval.

Present a compact repair plan before any edits. Include enough before/after text for the user to judge the change. Ask no more than three focused questions at a time; group repeated decisions by rule rather than asking per occurrence. Use an interactive input tool when available, otherwise ask concise plain-text questions.

Always pause after presenting the plan. Do not apply fixes in the same turn. A useful approval question is: “是否应用上述确定性修复，并按推荐方案处理待复核项？”

## Phase 3: Incorporate feedback

Treat the user's reply as a continuation of the existing review. Do not restart from Phase 1 unless the scope changed, relevant files changed, or the reply requests another inspection.

Map the reply to each proposed group or decision:

- Apply approved definite repairs and selected alternatives.
- Leave rejected or deferred items unchanged.
- Interpret “全部按推荐方案” as approval of definite repairs and explicitly recommended review items, not suggestions-only items.
- Ask a follow-up question when feedback is ambiguous or does not resolve a meaning-sensitive decision. Continue to pause; do not partially edit while required decisions remain unresolved unless the user explicitly approves an independent subset.

Before editing after a delayed reply, verify that the selected files still match the inspected state. If they changed, explain what changed and re-inspect the affected parts.

## Phase 4: Fix and validate

1. Apply the smallest patch that implements the approved repair set. Preserve technical meaning, Markdown extensions, code behavior, URLs, heading anchors, and authorial tone except where the user approved a change.
2. Do not apply rejected suggestions, unreviewed meaning-sensitive changes, or changes outside the selected scope.
3. Re-run `audit_posts.py` on the same scope. Fix remaining diagnostics only when they fall within an approved category. If a new judgment-sensitive issue appears, return to Phase 2 for that issue before changing it.
4. Run the validation commands documented by the repository. For this repository, use the full publication checks from `README.md` when available:

   ```bash
   pnpm content:verify
   pnpm check
   pnpm type-check
   pnpm build
   pnpm check:site
   ```

   If a command cannot run because dependencies, network access, or environment requirements are unavailable, report the exact command and blocker. Do not claim validation passed.
5. Inspect the final diff. Ensure only selected posts changed unless the user explicitly approved another artifact, and preserve unrelated pre-existing changes.

## Link validation

Always validate local images and links. For external HTTP(S) links, deduplicate URLs and check the final destination using available web access or an HTTP client. Follow redirects; if `HEAD` is rejected, retry with a small `GET`. Treat `2xx` as valid and a stable `404`/`410` as broken. Treat `401`, `403`, `429`, timeouts, TLS failures, bot challenges, and transient `5xx` responses as inconclusive unless an independent check proves the target is gone.

Never propose replacing or removing an external link solely because an automated request is inconclusive. For a replacement, show the proposed destination during Phase 2, verify that it supports the same claim, and prefer an official source.

## Editing guardrails

- Exclude fenced code, inline code, commands, URLs, file paths, identifiers, and quoted literal output from prose-only normalization unless they are themselves wrong.
- Add Chinese/English boundary spaces in prose, but preserve established product names and syntax. Use punctuation appropriate to the surrounding language.
- Preserve intentional hard line breaks, tables, math, directives, admonitions, raw HTML, and Expressive Code metadata.
- Do not change publication dates, facts, API names, version numbers, or runnable examples without explicit item-level approval.
- Do not update `updated` automatically unless the user approves it or the repository convention requires it.
- Do not touch unselected posts to create global consistency. Report cross-scope inconsistencies instead.

## Final handoff

After Phase 4, lead with whether the approved repair set was completed. Then state:

- the resolved scope;
- changed files and concise categories of approved fixes;
- rejected, deferred, or still-inconclusive items;
- link-check outcomes;
- validation commands and outcomes.

Do not list every mechanical punctuation or spacing edit; summarize repeated patterns and identify judgment-sensitive changes individually.
