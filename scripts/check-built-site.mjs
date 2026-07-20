import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteOrigin } from "../site.config.mjs";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const distRoot = path.join(repoRoot, "dist");
const postsRoot = path.join(repoRoot, "src", "content", "posts");
const expectedOrigin = siteOrigin;
const failures = [];

if (!fs.existsSync(distRoot)) {
	console.error("dist/ does not exist; run pnpm build first.");
	process.exit(1);
}

function walk(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(file) : [file];
	});
}

function localTargetExists(pathname) {
	let decoded;
	try {
		decoded = decodeURI(pathname);
	} catch {
		decoded = pathname;
	}
	const relative = decoded.replace(/^\/+/, "");
	const direct = path.join(distRoot, relative);
	return (
		fs.existsSync(direct) || fs.existsSync(path.join(direct, "index.html"))
	);
}

const htmlFiles = walk(distRoot).filter((file) => file.endsWith(".html"));
const postPages = htmlFiles.filter(
	(file) =>
		file.includes(`${path.sep}posts${path.sep}`) &&
		file.endsWith(`${path.sep}index.html`),
);
const publicPostCount = walk(postsRoot)
	.filter((file) => /\.mdx?$/.test(file))
	.filter((file) =>
		/^draft:\s*false\s*$/m.test(fs.readFileSync(file, "utf8")),
	).length;
if (postPages.length !== publicPostCount)
	failures.push(
		`Expected ${publicPostCount} generated post pages, found ${postPages.length}.`,
	);
const notFoundPage = path.join(distRoot, "404.html");
if (!fs.existsSync(notFoundPage))
	failures.push(
		"A top-level 404.html is required for correct Cloudflare Pages 404 responses.",
	);

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const relativeFile = path.relative(distRoot, file);
	if (!html.includes(expectedOrigin) && relativeFile !== "404.html")
		failures.push(`Expected canonical origin is absent in ${relativeFile}.`);

	const pagePath = `/${relativeFile.replace(/index\.html$/, "")}`;
	const canonicalMatches = [
		...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/g),
	];
	if (relativeFile === "404.html") {
		if (canonicalMatches.length > 0)
			failures.push("404.html must not advertise a canonical URL.");
		if (!html.includes('<meta name="robots" content="noindex, nofollow">'))
			failures.push("404.html must be excluded from indexing.");
	} else {
		const expectedCanonical = new URL(pagePath, expectedOrigin).href;
		if (canonicalMatches.length !== 1)
			failures.push(`Expected exactly one canonical URL in ${relativeFile}.`);
		else if (canonicalMatches[0][1] !== expectedCanonical)
			failures.push(
				`Incorrect canonical URL in ${relativeFile}: ${canonicalMatches[0][1]}`,
			);
		if (
			!html.includes(`<meta property="og:url" content="${expectedCanonical}">`)
		)
			failures.push(`Incorrect Open Graph URL in ${relativeFile}.`);
		if (
			!html.includes(
				`<meta property="twitter:url" content="${expectedCanonical}">`,
			)
		)
			failures.push(`Incorrect Twitter URL in ${relativeFile}.`);
	}
	for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
		const value = match[1];
		if (/^(?:#|mailto:|data:|javascript:)/.test(value)) continue;
		let target;
		try {
			target = new URL(value, `${expectedOrigin}${pagePath}`);
		} catch {
			failures.push(`Invalid URL in ${relativeFile}: ${value}`);
			continue;
		}
		if (
			target.origin === expectedOrigin &&
			!localTargetExists(target.pathname)
		) {
			failures.push(
				`Broken local target in ${relativeFile}: ${target.pathname}`,
			);
		}
	}
}

for (const generatedFile of [
	"rss.xml",
	"robots.txt",
	"sitemap-index.xml",
	"sitemap-0.xml",
]) {
	const file = path.join(distRoot, generatedFile);
	if (!fs.existsSync(file)) {
		failures.push(`${generatedFile} was not generated.`);
		continue;
	}
	const content = fs.readFileSync(file, "utf8");
	if (!content.includes(expectedOrigin))
		failures.push(`${generatedFile} does not use ${expectedOrigin}.`);
}

if (failures.length > 0) {
	console.error(Array.from(new Set(failures)).join("\n"));
	process.exit(1);
}

console.log(
	`Checked ${htmlFiles.length} HTML files and ${postPages.length} post pages for canonical metadata, feeds, and local links.`,
);
