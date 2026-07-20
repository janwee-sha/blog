import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const postsRoot = path.join(repoRoot, "src", "content", "posts");
const specRoot = path.join(repoRoot, "src", "content", "spec");
const publicRoot = path.join(repoRoot, "public");
const failures = [];

function walk(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(file) : [file];
	});
}

function frontmatterFor(file) {
	const source = fs.readFileSync(file, "utf8");
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) {
		failures.push(
			`${path.relative(repoRoot, file)} has no valid YAML frontmatter block.`,
		);
		return { source, frontmatter: "" };
	}
	return { source, frontmatter: match[1] };
}

function scalar(frontmatter, field) {
	const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return (
		frontmatter.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "m"))?.[1] ??
		null
	);
}

function unquote(value) {
	if (!value) return "";
	const first = value[0];
	return (first === '"' || first === "'") && value.at(-1) === first
		? value.slice(1, -1).trim()
		: value.trim();
}

const postFiles = walk(postsRoot).filter((file) => /\.mdx?$/.test(file));
const slugs = new Set();
let publicPostCount = 0;
const contentFiles = [
	...postFiles,
	...walk(specRoot).filter((file) => /\.mdx?$/.test(file)),
];

for (const file of postFiles) {
	const relative = path.relative(postsRoot, file);
	const slug = relative
		.replace(/\.mdx?$/, "")
		.split(path.sep)
		.join("/");
	if (slugs.has(slug)) failures.push(`Duplicate post slug: ${slug}`);
	slugs.add(slug);

	const { frontmatter } = frontmatterFor(file);
	if (!unquote(scalar(frontmatter, "title")))
		failures.push(`${relative} is missing a non-empty title.`);

	const published = unquote(scalar(frontmatter, "published"));
	if (!published || Number.isNaN(Date.parse(published)))
		failures.push(`${relative} has an invalid published date.`);

	const draft = scalar(frontmatter, "draft");
	if (draft !== "true" && draft !== "false")
		failures.push(`${relative} must declare draft: true or draft: false.`);
	if (draft === "false") publicPostCount += 1;
}

if (postFiles.length === 0) failures.push("No Markdown posts were found.");
if (publicPostCount === 0)
	failures.push("At least one public post with draft: false is required.");
if (!fs.existsSync(path.join(specRoot, "about.md")))
	failures.push("src/content/spec/about.md is required.");
if (
	walk(path.join(repoRoot, "src", "content")).some((file) =>
		/(^|[/\\])privacy\.mdx?$/.test(file),
	)
) {
	failures.push("Privacy content must not be published.");
}
if (fs.existsSync(path.join(publicRoot, "uploads", "nsl_avatars")))
	failures.push("Private nsl_avatars media must not be published.");

const uploadReferences = new Set();
for (const file of contentFiles) {
	const source = fs.readFileSync(file, "utf8");
	const relative = path.relative(repoRoot, file);
	if (/https:\/\/static\.janwee\.blog|\/wp-content\/uploads\//i.test(source)) {
		failures.push(
			`Legacy production or WordPress media URL remains in ${relative}.`,
		);
	}
	for (const match of source.matchAll(/\/uploads\/[^)\]\s"'<>]+/g))
		uploadReferences.add(match[0]);
}

for (const reference of uploadReferences) {
	let pathname = reference.split(/[?#]/, 1)[0];
	try {
		pathname = decodeURI(pathname);
	} catch {
		failures.push(`Invalid encoded media URL: ${reference}`);
		continue;
	}
	const target = path.resolve(publicRoot, pathname.replace(/^\/+/, ""));
	if (!target.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(target))
		failures.push(`Missing public media file: ${reference}`);
}

const redirectsFile = path.join(publicRoot, "_redirects");
if (!fs.existsSync(redirectsFile)) {
	failures.push("public/_redirects is required.");
} else {
	const sources = new Set();
	for (const [index, rawLine] of fs
		.readFileSync(redirectsFile, "utf8")
		.split(/\r?\n/)
		.entries()) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const fields = line.split(/\s+/);
		if (
			fields.length !== 3 ||
			!fields[0].startsWith("/") ||
			!fields[1].startsWith("/") ||
			!/^(301|302|303|307|308)$/.test(fields[2])
		) {
			failures.push(`Invalid redirect on line ${index + 1}: ${line}`);
			continue;
		}
		if (sources.has(fields[0]))
			failures.push(`Duplicate redirect source: ${fields[0]}`);
		sources.add(fields[0]);
	}
	if (sources.size === 0)
		failures.push("At least one compatibility redirect is required.");
}

if (failures.length > 0) {
	console.error(Array.from(new Set(failures)).join("\n"));
	process.exit(1);
}

console.log(
	`Verified ${postFiles.length} posts (${publicPostCount} public) and ${uploadReferences.size} referenced media files.`,
);
