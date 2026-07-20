import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const distRoot = path.join(repoRoot, "dist");
const postsRoot = path.join(repoRoot, "src", "content", "posts");
const expectedOrigin = "https://janwee.blog";
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
if (fs.existsSync(path.join(distRoot, "privacy", "index.html")))
	failures.push("Privacy page must not be generated.");
const notFoundPage = path.join(distRoot, "404.html");
if (!fs.existsSync(notFoundPage))
	failures.push(
		"A top-level 404.html is required for correct Cloudflare Pages 404 responses.",
	);

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const relativeFile = path.relative(distRoot, file);
	if (/fuwari\.vercel\.app|Lorem Ipsum|Demo Site/.test(html))
		failures.push(`Demo identity remains in ${relativeFile}.`);
	if (html.includes("https://static.janwee.blog"))
		failures.push(`Legacy canonical origin remains in ${relativeFile}.`);
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
		const documentedLocalOpenClawDashboard =
			relativeFile === "posts/getting-started-with-openclaw/index.html" &&
			target.href === "http://localhost:18789/";
		if (
			target.hostname === "142.171.184.180" ||
			(target.hostname === "localhost" && !documentedLocalOpenClawDashboard)
		) {
			failures.push(`Internal development link in ${relativeFile}: ${value}`);
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
	if (content.includes("https://static.janwee.blog"))
		failures.push(`Legacy origin remains in ${generatedFile}.`);
}

const sourceRedirects = path.join(repoRoot, "public", "_redirects");
const builtRedirects = path.join(distRoot, "_redirects");
if (!fs.existsSync(builtRedirects))
	failures.push("The built site is missing _redirects.");
else if (
	fs.readFileSync(sourceRedirects, "utf8") !==
	fs.readFileSync(builtRedirects, "utf8")
) {
	failures.push("The built _redirects file differs from public/_redirects.");
}

if (failures.length > 0) {
	console.error(Array.from(new Set(failures)).join("\n"));
	process.exit(1);
}

console.log(
	`Checked ${htmlFiles.length} HTML files and ${postPages.length} post pages for canonical metadata, feeds, redirects, local links, and demo identity.`,
);
