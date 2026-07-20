import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");
const expectedOrigin = "https://static.janwee.blog";
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
	return fs.existsSync(direct) || fs.existsSync(path.join(direct, "index.html"));
}

const htmlFiles = walk(distRoot).filter((file) => file.endsWith(".html"));
const postPages = htmlFiles.filter((file) => file.includes(`${path.sep}posts${path.sep}`) && file.endsWith(`${path.sep}index.html`));
if (postPages.length !== 17) failures.push(`Expected 17 generated post pages, found ${postPages.length}.`);
if (fs.existsSync(path.join(distRoot, "privacy", "index.html"))) failures.push("Privacy page must not be generated.");
const notFoundPage = path.join(distRoot, "404.html");
if (!fs.existsSync(notFoundPage)) failures.push("A top-level 404.html is required for correct Cloudflare Pages 404 responses.");

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const relativeFile = path.relative(distRoot, file);
	if (/fuwari\.vercel\.app|Lorem Ipsum|Demo Site/.test(html)) failures.push(`Demo identity remains in ${relativeFile}.`);
	if (!html.includes(expectedOrigin) && relativeFile !== "404.html") failures.push(`Expected canonical origin is absent in ${relativeFile}.`);

	const pagePath = `/${relativeFile.replace(/index\.html$/, "")}`;
	const canonicalMatches = [...html.matchAll(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/g)];
	if (relativeFile === "404.html") {
		if (canonicalMatches.length > 0) failures.push("404.html must not advertise a canonical URL.");
		if (!html.includes('<meta name="robots" content="noindex, nofollow">')) failures.push("404.html must be excluded from indexing.");
	} else {
		const expectedCanonical = new URL(pagePath, expectedOrigin).href;
		if (canonicalMatches.length !== 1) failures.push(`Expected exactly one canonical URL in ${relativeFile}.`);
		else if (canonicalMatches[0][1] !== expectedCanonical) failures.push(`Incorrect canonical URL in ${relativeFile}: ${canonicalMatches[0][1]}`);
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
			relativeFile === "posts/getting-started-with-openclaw/index.html"
			&& target.href === "http://localhost:18789/";
		if (target.hostname === "142.171.184.180" || (target.hostname === "localhost" && !documentedLocalOpenClawDashboard)) {
			failures.push(`Internal development link in ${relativeFile}: ${value}`);
		}
		if (target.origin === expectedOrigin && !localTargetExists(target.pathname)) {
			failures.push(`Broken local target in ${relativeFile}: ${target.pathname}`);
		}
	}
}

if (failures.length > 0) {
	console.error(Array.from(new Set(failures)).join("\n"));
	process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files and ${postPages.length} post pages for local broken links and demo identity.`);
