import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sanitizeHtml from "sanitize-html";
import TurndownService from "turndown";
import gfmPlugin from "turndown-plugin-gfm";

const { gfm } = gfmPlugin;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const DEFAULT_INPUT = path.join(repoRoot, ".migration", "wordpress-export.json");
const DEFAULT_UPLOADS = path.resolve(repoRoot, "..", "wpdata", "wp-content", "uploads");
const PROFILE_AVATAR_ATTACHMENT_ID = 8539;
const PROFILE_AVATAR_PATH = "2025/07/my_avatar-300x300.jpg";
const KNOWN_WORDPRESS_HOSTS = new Set([
	"janwee.blog",
	"www.janwee.blog",
	"janweehsia.top",
	"www.janweehsia.top",
	"142.171.184.180",
]);

const sanitizeOptions = {
	allowedTags: [
		...sanitizeHtml.defaults.allowedTags,
		"img",
		"figure",
		"figcaption",
		"details",
		"summary",
	],
	allowedAttributes: {
		a: ["href", "title", "target", "rel"],
		img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
		code: ["class"],
		span: ["class"],
		ol: ["start"],
		td: ["colspan", "rowspan"],
		th: ["colspan", "rowspan"],
	},
	allowedSchemes: ["http", "https", "mailto"],
	allowProtocolRelative: false,
};

function parseArguments(argv) {
	const values = { input: DEFAULT_INPUT, uploads: DEFAULT_UPLOADS };
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--input" && argv[index + 1]) values.input = path.resolve(argv[++index]);
		else if (argv[index] === "--uploads" && argv[index + 1]) values.uploads = path.resolve(argv[++index]);
		else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
	}
	return values;
}

export function decodeHtmlEntities(value = "") {
	const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"', "#039": "'" };
	return String(value)
		.replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)))
		.replace(/&#([0-9]+);/g, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)))
		.replace(/&([a-z]+|#039);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function safeDecodeURIComponent(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function normalizeUploadPath(value) {
	const decoded = safeDecodeURIComponent(value).replace(/^\/+/, "");
	const normalized = path.posix.normalize(decoded);
	if (!normalized || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
		return null;
	}
	return normalized;
}

function publicUploadUrl(relativePath) {
	return encodeURI(`/uploads/${relativePath}`).replaceAll("#", "%23");
}

export function rewriteWordPressUrl(input, postSlugs = new Set(), mediaPaths = new Set()) {
	if (!input || typeof input !== "string") return input ?? "";
	const value = decodeHtmlEntities(input.trim());
	if (!value || value.startsWith("#") || value.startsWith("mailto:")) return value;

	if (value.startsWith("/wp-content/uploads/")) {
		const relativePath = normalizeUploadPath(value.slice("/wp-content/uploads/".length).split(/[?#]/, 1)[0]);
		if (!relativePath) return value;
		mediaPaths.add(relativePath);
		return publicUploadUrl(relativePath);
	}

	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		return value;
	}

	if (!KNOWN_WORDPRESS_HOSTS.has(parsed.hostname.toLowerCase())) return value;
	const uploadPrefix = "/wp-content/uploads/";
	if (parsed.pathname.startsWith(uploadPrefix)) {
		const relativePath = normalizeUploadPath(parsed.pathname.slice(uploadPrefix.length));
		if (!relativePath) return value;
		mediaPaths.add(relativePath);
		return publicUploadUrl(relativePath);
	}

	const pathname = safeDecodeURIComponent(parsed.pathname).replace(/^\/+|\/+$/g, "");
	if (pathname === "about-me") return "/about/";
	if (postSlugs.has(pathname)) return `/posts/${pathname}/`;
	return value;
}

function makeTurndown(context) {
	const service = new TurndownService({
		bulletListMarker: "-",
		codeBlockStyle: "fenced",
		emDelimiter: "_",
		headingStyle: "atx",
		strongDelimiter: "**",
	});
	service.use(gfm);
	service.addRule("migration-links", {
		filter: "a",
		replacement(content, node) {
			const href = context.rewriteUrl(node.getAttribute("href") ?? "");
			const title = node.getAttribute("title");
			if (!href) return content;
			return `[${content || href}](${href}${title ? ` \"${title.replaceAll('"', '\\"')}\"` : ""})`;
		},
	});
	service.addRule("migration-images", {
		filter: "img",
		replacement(_content, node) {
			const source = context.rewriteUrl(node.getAttribute("src") ?? "");
			const alt = (node.getAttribute("alt") ?? "").replaceAll("[", "\\[").replaceAll("]", "\\]");
			const title = node.getAttribute("title");
			return source ? `![${alt}](${source}${title ? ` \"${title.replaceAll('"', '\\"')}\"` : ""})` : "";
		},
	});
	return service;
}

function htmlToMarkdown(html, context) {
	if (!html) return "";
	const cleanHtml = sanitizeHtml(String(html), sanitizeOptions);
	return makeTurndown(context).turndown(cleanHtml).trim();
}

function inlineMarkdown(html, context) {
	return htmlToMarkdown(html, context).replace(/\s*\n+\s*/g, " ").trim();
}

function headingLevel(value) {
	const match = /^h([1-6])$/i.exec(value ?? "");
	const level = match ? Number(match[1]) : 2;
	return level === 1 ? 2 : Math.min(Math.max(level, 2), 6);
}

function blockquote(markdown) {
	return markdown
		.split("\n")
		.map((line) => `> ${line}`.trimEnd())
		.join("\n");
}

export function fenceCode(code, language = "text") {
	const value = decodeHtmlEntities(String(code ?? "")).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
	const longestFence = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
	const fence = "`".repeat(Math.max(3, longestFence + 1));
	const languageMap = { javascript: "js", shell: "bash", markup: "html", plaintext: "text", "": "text" };
	const normalizedLanguage = languageMap[String(language ?? "").toLowerCase()] ?? String(language).toLowerCase();
	return `${fence}${normalizedLanguage}\n${value.replace(/\n+$/, "")}\n${fence}`;
}

function convertDataTable(settings, context) {
	const headers = (settings.eael_data_table_header_cols_data ?? []).map((entry) =>
		inlineMarkdown(entry.eael_data_table_header_col ?? "", context),
	);
	const cells = (settings.eael_data_table_content_rows ?? [])
		.filter((entry) => entry.eael_data_table_content_row_type === "col")
		.map((entry) => inlineMarkdown(entry.eael_data_table_content_row_title ?? entry.eael_data_table_content_row_content ?? "", context));
	if (headers.length === 0) return "";
	const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
	const rows = [];
	for (let index = 0; index < cells.length; index += headers.length) {
		const row = cells.slice(index, index + headers.length);
		while (row.length < headers.length) row.push("");
		rows.push(`| ${row.map(escapeCell).join(" | ")} |`);
	}
	return [
		`| ${headers.map(escapeCell).join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...rows,
	].join("\n");
}

function convertWidget(node, context) {
	const settings = node.settings ?? {};
	context.widgetCounts[node.widgetType] = (context.widgetCounts[node.widgetType] ?? 0) + 1;

	switch (node.widgetType) {
		case "heading": {
			const title = inlineMarkdown(settings.title ?? "", context);
			return title ? `${"#".repeat(headingLevel(settings.header_size))} ${title}` : "";
		}
		case "eael-dual-color-header": {
			const title = inlineMarkdown(`${settings.eael_dch_first_title ?? ""}${settings.eael_dch_last_title ?? ""}`, context);
			const subtext = htmlToMarkdown(settings.eael_dch_subtext ?? "", context);
			return [title ? `${"#".repeat(headingLevel(settings.title_tag))} ${title}` : "", subtext].filter(Boolean).join("\n\n");
		}
		case "text-editor":
			return htmlToMarkdown(settings.editor ?? "", context);
		case "code-highlight":
			return fenceCode(settings.code ?? "", settings.language ?? "text");
		case "blockquote": {
			const content = htmlToMarkdown(settings.blockquote_content ?? "", context);
			const author = inlineMarkdown(settings.author_name ?? "", context);
			return content ? blockquote([content, author ? `— ${author}` : ""].filter(Boolean).join("\n\n")) : "";
		}
		case "image": {
			const image = settings.image ?? {};
			const source = context.rewriteUrl(image.url ?? "");
			const attachment = context.attachments[String(image.id ?? "")];
			const alt = decodeHtmlEntities(attachment?.alt || settings.caption || attachment?.title || "").replaceAll("[", "\\[").replaceAll("]", "\\]");
			const rendered = source ? `![${alt}](${source})` : "";
			const target = context.rewriteUrl(settings.link?.url ?? "");
			return rendered && target ? `[${rendered}](${target})` : rendered;
		}
		case "shortcode": {
			const value = String(settings.shortcode ?? "").trim();
			const mermaid = /^\[mermaid\]([\s\S]*?)\[\/mermaid\]$/i.exec(value);
			if (mermaid) return fenceCode(mermaid[1].trim(), "mermaid");
			context.unsupported.push({ slug: context.slug, widget: node.widgetType, node_id: node.id ?? "", detail: value.slice(0, 100) });
			return "";
		}
		case "eael-data-table":
			return convertDataTable(settings, context);
		case "alert": {
			const title = inlineMarkdown(settings.alert_title ?? "注意", context);
			const description = htmlToMarkdown(settings.alert_description ?? "", context);
			return blockquote(`[!CAUTION]\n${title ? `**${title}**\n\n` : ""}${description}`);
		}
		case "pp-info-box": {
			const description = htmlToMarkdown(settings.description ?? "", context);
			return description ? blockquote(`[!NOTE]\n${description}`) : "";
		}
		case "divider":
			return "---";
		case "spacer":
		case "share-buttons":
			context.omitted[node.widgetType] = (context.omitted[node.widgetType] ?? 0) + 1;
			return "";
		default:
			context.unsupported.push({ slug: context.slug, widget: node.widgetType, node_id: node.id ?? "" });
			return "";
	}
}

export function convertElementorTree(nodes, context) {
	const blocks = [];
	for (const node of nodes ?? []) {
		if (node?.widgetType) {
			const converted = convertWidget(node, context).trim();
			if (converted) blocks.push(converted);
		}
		if (Array.isArray(node?.elements) && node.elements.length > 0) {
			const nested = convertElementorTree(node.elements, context).trim();
			if (nested) blocks.push(nested);
		}
	}
	return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

function collectUploadUrls(value, context) {
	if (typeof value === "string") {
		for (const match of value.matchAll(/(?:https?:\/\/[^\s"'<>]+)?\/wp-content\/uploads\/[^\s"'<>),]+/gi)) {
			context.rewriteUrl(match[0]);
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectUploadUrls(item, context);
		return;
	}
	if (value && typeof value === "object") {
		for (const item of Object.values(value)) collectUploadUrls(item, context);
	}
}

export function textDescription(post, markdown) {
	const source = post.excerpt || post.seo?.description || markdown;
	const decoded = decodeHtmlEntities(String(source));
	const withoutMarkup = sanitizeHtml(
		decoded.replace(/```[\s\S]*?```/g, " ").replace(/^>.*$/gm, " "),
		{ allowedTags: [], allowedAttributes: {} },
	)
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
		.replace(/[*_`|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return withoutMarkup.slice(0, 180);
}

export function selectCategory(post) {
	const categories = post.categories ?? [];
	if (post.slug === "thread-safe-implementations-of-java-singleton-design-pattern") {
		const designPattern = categories.find((category) => category.slug === "design-pattern");
		return decodeHtmlEntities(designPattern?.name ?? designPattern?.slug ?? "设计模式");
	}
	const configured = categories.find((category) => category.id === Number(post.seo?.primary_category));
	const category = configured ?? categories[0];
	return decodeHtmlEntities(category?.name ?? safeDecodeURIComponent(category?.slug ?? ""));
}

function yamlString(value) {
	return JSON.stringify(decodeHtmlEntities(String(value ?? "")));
}

function makeFrontmatter(post, markdown) {
	const published = post.date.slice(0, 10);
	const updated = post.modified.slice(0, 10);
	const tags = Array.from(new Set((post.tags ?? []).map((tag) => decodeHtmlEntities(tag.name ?? safeDecodeURIComponent(tag.slug)))));
	if (post.slug === "thread-safe-implementations-of-java-singleton-design-pattern" && !tags.includes("Java")) tags.push("Java");
	const values = [
		"---",
		`title: ${yamlString(post.title)}`,
		`published: ${published}`,
	];
	if (updated > published) values.push(`updated: ${updated}`);
	values.push(
		`description: ${yamlString(textDescription(post, markdown))}`,
		'image: ""',
		`tags: [${tags.map(yamlString).join(", ")}]`,
		`category: ${yamlString(selectCategory(post))}`,
		"draft: false",
		'lang: "zh_CN"',
		"---",
		"",
	);
	return values.join("\n");
}

function attachmentRelativePath(attachment) {
	if (attachment?.file) return normalizeUploadPath(attachment.file);
	if (!attachment?.url) return null;
	try {
		const parsed = new URL(attachment.url);
		const marker = "/wp-content/uploads/";
		return parsed.pathname.includes(marker) ? normalizeUploadPath(parsed.pathname.split(marker)[1]) : null;
	} catch {
		return null;
	}
}

function addSiteAsset(attachmentId, snapshot, context) {
	const attachment = snapshot.attachments[String(attachmentId)];
	const relativePath = attachmentRelativePath(attachment);
	if (relativePath) context.mediaPaths.add(relativePath);
	return relativePath;
}

function migrationContext(snapshot, postSlugs) {
	const context = {
		attachments: snapshot.attachments ?? {},
		mediaPaths: new Set(),
		omitted: {},
		postSlugs,
		slug: "",
		unsupported: [],
		widgetCounts: {},
	};
	context.rewriteUrl = (value) => rewriteWordPressUrl(value, context.postSlugs, context.mediaPaths);
	return context;
}

function ensureDirectory(directory) {
	fs.mkdirSync(directory, { recursive: true });
}

function writeJson(file, value) {
	ensureDirectory(path.dirname(file));
	fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function stripTrailingWhitespace(value) {
	return value.replace(/[ \t]+$/gm, "");
}

function copyMedia(context, uploadsRoot) {
	const missing = [];
	for (const relativePath of Array.from(context.mediaPaths).sort()) {
		const source = path.resolve(uploadsRoot, relativePath);
		const uploadsBase = `${path.resolve(uploadsRoot)}${path.sep}`;
		if (!source.startsWith(uploadsBase) || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
			missing.push(relativePath);
			continue;
		}
		const target = path.join(repoRoot, "public", "uploads", relativePath);
		ensureDirectory(path.dirname(target));
		fs.copyFileSync(source, target);
	}
	return missing;
}

export function runMigration({ input = DEFAULT_INPUT, uploads = DEFAULT_UPLOADS } = {}) {
	const snapshot = JSON.parse(fs.readFileSync(input, "utf8"));
	const posts = snapshot.posts.filter((post) => post.type === "post");
	const about = snapshot.posts.find((post) => post.type === "page" && post.slug === "about-me");
	const privacy = snapshot.posts.find((post) => post.type === "page" && post.slug === "privacy");
	if (posts.length !== 17) throw new Error(`Expected 17 public posts, found ${posts.length}.`);
	if (!about) throw new Error("The public About page was not found.");
	if (!privacy) throw new Error("The public Privacy page was not found for the exclusion audit.");

	const postSlugs = new Set(posts.map((post) => post.slug));
	const context = migrationContext(snapshot, postSlugs);
	const generatedPosts = [];
	for (const post of posts) {
		context.slug = post.slug;
		const elementor = JSON.parse(post.elementor_data);
		collectUploadUrls(elementor, context);
		const markdown = convertElementorTree(elementor, context).trim();
		if (!markdown) throw new Error(`Converted article is empty: ${post.slug}`);
		generatedPosts.push({
			post,
			content: stripTrailingWhitespace(`${makeFrontmatter(post, markdown)}${markdown}\n`),
		});
	}

	context.slug = about.slug;
	const aboutElementor = JSON.parse(about.elementor_data);
	collectUploadUrls(aboutElementor, context);
	const aboutMarkdown = convertElementorTree(aboutElementor, context)
		.replace(/(!\[[^\n]*\]\([^)]+\))\n\n\1/g, "$1")
		.trim();
	if (!aboutMarkdown) throw new Error("Converted About page is empty.");

	const publicAvatarAttachment = snapshot.attachments[String(PROFILE_AVATAR_ATTACHMENT_ID)];
	const avatarPath = publicAvatarAttachment ? PROFILE_AVATAR_PATH : null;
	if (avatarPath) context.mediaPaths.add(avatarPath);
	const siteIconPath = addSiteAsset(snapshot.site.site_icon_id, snapshot, context);
	if (!avatarPath || !siteIconPath) throw new Error("Unable to resolve the WordPress avatar or site icon attachment.");
	if (context.unsupported.length > 0) {
		throw new Error(`Unsupported Elementor widgets:\n${JSON.stringify(context.unsupported, null, 2)}`);
	}

	const missingMedia = copyMedia(context, uploads);
	if (missingMedia.length > 0) throw new Error(`Missing referenced media:\n${missingMedia.join("\n")}`);

	const postsDirectory = path.join(repoRoot, "src", "content", "posts");
	ensureDirectory(postsDirectory);
	for (const item of generatedPosts) {
		fs.writeFileSync(path.join(postsDirectory, `${item.post.slug}.md`), item.content);
	}
	fs.writeFileSync(
		path.join(repoRoot, "src", "content", "spec", "about.md"),
		stripTrailingWhitespace(`${aboutMarkdown}\n`),
	);

	const urlMap = [
		...posts.map((post) => ({
			wordpress: `https://janwee.blog/${post.slug}/`,
			static: `https://static.janwee.blog/posts/${post.slug}/`,
		})),
		{ wordpress: "https://janwee.blog/about-me/", static: "https://static.janwee.blog/about/" },
	];
	writeJson(path.join(repoRoot, "migration", "url-map.json"), urlMap);
	const redirects = [
		...posts.map((post) => `/${post.slug}/ /posts/${post.slug}/ 301`),
		"/about-me/ /about/ 301",
	];
	fs.writeFileSync(path.join(repoRoot, "public", "_redirects"), `${redirects.join("\n")}\n`);

	const report = {
		source: {
			wordpress_version: snapshot.wordpress_version,
			public_posts: posts.length,
			public_pages: 2,
			public_attachments_available: Object.keys(snapshot.attachments).length,
		},
		generated: {
			posts: generatedPosts.length,
			pages: ["about"],
			media_files: context.mediaPaths.size,
			redirects: redirects.length,
		},
		excluded: {
			pages: ["privacy"],
			comments: "not exported",
			non_public_posts: "not exported",
			user_private_data: "not exported",
		},
		widgets: Object.fromEntries(Object.entries(context.widgetCounts).sort(([a], [b]) => a.localeCompare(b))),
		omitted_layout_widgets: context.omitted,
		unsupported_widgets: context.unsupported,
		missing_media: missingMedia,
		site_assets: { avatar: avatarPath, icon: siteIconPath },
		site_asset_statuses: {
			avatar: `${publicAvatarAttachment?.status ?? "unknown"} (public derivative of attachment ${PROFILE_AVATAR_ATTACHMENT_ID})`,
			icon: snapshot.attachments[String(snapshot.site.site_icon_id)]?.status ?? "unknown",
		},
	};
	writeJson(path.join(repoRoot, "migration", "report.json"), report);
	return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		const report = runMigration(parseArguments(process.argv.slice(2)));
		console.log(`Migrated ${report.generated.posts} posts, ${report.generated.pages.length} page, and ${report.generated.media_files} media files.`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
