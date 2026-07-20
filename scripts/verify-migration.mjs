import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const report = JSON.parse(fs.readFileSync(path.join(repoRoot, "migration", "report.json"), "utf8"));
const urlMap = JSON.parse(fs.readFileSync(path.join(repoRoot, "migration", "url-map.json"), "utf8"));
const postsDirectory = path.join(repoRoot, "src", "content", "posts");
const articleFiles = fs.readdirSync(postsDirectory).filter((name) => name.endsWith(".md")).sort();

function walkFiles(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory() ? walkFiles(file) : [file];
	});
}

const failures = [];
if (articleFiles.length !== 17) failures.push(`Expected 17 article files, found ${articleFiles.length}.`);
if (report.generated.posts !== 17) failures.push("Migration report does not contain 17 generated posts.");
if (report.generated.pages.join(",") !== "about") failures.push("Only the About page should be generated.");
if (report.excluded.pages.join(",") !== "privacy") failures.push("Privacy exclusion is not recorded.");
if (report.unsupported_widgets.length !== 0) failures.push("Unsupported Elementor widgets remain.");
if (report.missing_media.length !== 0) failures.push("Missing media remain.");
if (urlMap.length !== 18) failures.push(`Expected 18 URL mappings, found ${urlMap.length}.`);
if (!fs.existsSync(path.join(repoRoot, "src", "content", "spec", "about.md"))) failures.push("About page is missing.");
if (fs.existsSync(path.join(postsDirectory, "privacy.md"))) failures.push("Privacy must not be published.");
const mediaFiles = walkFiles(path.join(repoRoot, "public", "uploads"));
if (mediaFiles.length !== report.generated.media_files) {
	failures.push(`Expected ${report.generated.media_files} migrated media files, found ${mediaFiles.length}.`);
}
if (fs.existsSync(path.join(repoRoot, "public", "uploads", "nsl_avatars"))) {
	failures.push("The private legacy avatar directory must not be published.");
}

const slugs = new Set();
for (const name of articleFiles) {
	const file = path.join(postsDirectory, name);
	const content = fs.readFileSync(file, "utf8");
	const slug = name.replace(/\.md$/, "");
	if (slugs.has(slug)) failures.push(`Duplicate slug: ${slug}`);
	slugs.add(slug);
	if (!content.startsWith("---\n")) failures.push(`Missing frontmatter: ${name}`);
	if (!/^draft: false$/m.test(content)) failures.push(`Article is not explicitly public: ${name}`);
	if (!/^lang: "zh_CN"$/m.test(content)) failures.push(`Article language is incorrect: ${name}`);
	for (const match of content.matchAll(/\]\((\/uploads\/[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
		const relativePath = decodeURI(match[1].slice("/uploads/".length));
		if (!fs.existsSync(path.join(repoRoot, "public", "uploads", relativePath))) {
			failures.push(`Missing media target in ${name}: ${match[1]}`);
		}
	}
}

const redirects = fs.readFileSync(path.join(repoRoot, "public", "_redirects"), "utf8").trim().split("\n");
if (redirects.length !== 18) failures.push(`Expected 18 redirect rules, found ${redirects.length}.`);

if (failures.length > 0) {
	console.error(failures.join("\n"));
	process.exit(1);
}

console.log(`Verified ${articleFiles.length} articles, ${mediaFiles.length} media files, and ${redirects.length} redirects.`);
