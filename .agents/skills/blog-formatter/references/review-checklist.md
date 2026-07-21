# Required review checklist

Apply every section to each selected post during the inspection phase. Use the repository's current schema, plugins, scripts, and established conventions as the source of truth. Do not edit until the user has reviewed the proposed repair set and responded.

## 1. Standard Markdown

- Require a well-formed opening YAML frontmatter block and a final newline.
- Check ATX heading syntax, hierarchy without unexplained level jumps, unique headings, and consistent numbering. Remember that the page template may already render the frontmatter title as the page H1.
- Check blank lines around headings, lists, block quotes, tables, and fenced code where Markdown parsing depends on them.
- Check list indentation, ordered-list continuity when meaningful, task-list syntax, and consistent marker/spacing style within the post.
- Balance backtick and tilde fences. Use a valid language identifier when known, and preserve Expressive Code metadata.
- Check emphasis, escaping, nested delimiters, inline code, block quotes, tables, and link/image syntax for accidental breakage.
- Flag trailing whitespace, tabs in prose, non-breaking spaces, repeated blank lines, merge markers, and accidental raw HTML.
- Preserve an intentional two-space hard break unless a normal paragraph break is clearly intended.

## 2. Astro and repository conventions

- Read `src/content/config.ts` and validate fields against the current posts collection schema.
- Reconcile the schema with `README.md`, the post generator, and validation scripts. A field can be schema-optional yet required by repository publication policy.
- Check YAML types, duplicate keys, quoting, ISO dates, booleans, arrays, and unknown keys. Keep `published` and `updated` chronologically plausible; do not change dates without evidence.
- Check the slug implied by the path, `draft` state, language tag, category, tags, description, and cover image for internal consistency.
- Keep the description useful, grammatical, non-truncated, and representative of the article. Avoid copying navigation text or an arbitrary slice of the body.
- Preserve supported repository extensions: math, directives, GitHub-style admonitions, custom components, and Expressive Code annotations.
- Run Astro/content/build checks rather than assuming parse validity from visual inspection.

## 3. Chinese copy editing and mixed-language spacing

- Correct clear typos, duplicated or missing words, malformed sentences, incorrect particles, punctuation, and subject–predicate or modifier ambiguity.
- Add one normal-width space between Chinese text and adjacent Latin words, acronyms, or Arabic numerals in prose, for example `使用 Java 编写` and `MySQL 8.0 引入`.
- Do not add spaces inside product names, identifiers, versions, URLs, paths, commands, code, or quoted literal output.
- Prefer Chinese full-width punctuation in Chinese sentences and English punctuation in English sentences. Remove stray spaces before Chinese punctuation.
- Check paired punctuation and quotes, especially `（）`, `“”`, `「」`, backticks, and parentheses containing English terms.
- Preserve the author's register. Fix grammar without turning the post into generic marketing copy.

## 4. Consistency

- Normalize capitalization and spelling of the same technology within the selected post, such as `GitHub`, `Java`, `JavaScript`, `MySQL`, `RabbitMQ`, and `Nginx`, while respecting official branding.
- Use one term for one concept unless a synonym is introduced deliberately. Check translations, abbreviations, singular/plural forms, and acronym expansion on first use.
- Keep heading numbering, list punctuation, code-fence labels, reference-list style, emphasis, and image-caption style internally consistent.
- Compare frontmatter wording and formatting with nearby posts only to discover conventions. Do not mass-normalize outside the selected scope.

## 5. Links and media

- Validate Markdown links, autolinks, HTML `href`/`src`, reference definitions, frontmatter images, and image sources used by custom syntax.
- Resolve root-relative media against `public/`. Resolve source-relative imports and media against the post location and repository rules. Reject paths that escape the repository.
- Decode percent-encoded paths for existence checks and ignore query strings/fragments when checking local files.
- Verify same-page fragments against generated heading IDs when practical. Use a build/site check for internal routes and generated pages.
- For external links, follow the status rules in `SKILL.md`. Record redirects that land on an unrelated page, parked domain, login wall, or generic home page.
- Require meaningful image alt text unless the image is intentionally decorative. Check that image claims, captions, dimensions, and formats are sensible.
- Do not classify example URLs such as `http://<your_ip>:8080` inside prose or code as broken production links.

## 6. Technical and editorial safety

- Check obvious factual self-contradictions, stale cross-references, duplicate headings/paragraphs, undefined abbreviations, and references never cited in the article.
- Check code block language labels and visible syntax, but do not refactor or “fix” runnable code without enough context and authorization.
- Preserve warnings, limitations, attribution, quotations, and license-sensitive text.
- Flag secrets, tokens, private hosts, personal data, and unsafe commands if present; do not repeat sensitive values in the report.
- Distinguish definite errors, likely improvements, and subjective suggestions. After the user responds, apply only the approved definite repairs and selected judgment-sensitive changes.
