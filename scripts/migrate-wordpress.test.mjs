import assert from "node:assert/strict";
import test from "node:test";
import { fenceCode, rewriteWordPressUrl, selectCategory, textDescription } from "./migrate-wordpress.mjs";

test("rewrites WordPress media URLs and records the file", () => {
	const media = new Set();
	assert.equal(
		rewriteWordPressUrl("https://janwee.blog/wp-content/uploads/2024/01/example.png", new Set(), media),
		"/uploads/2024/01/example.png",
	);
	assert.deepEqual([...media], ["2024/01/example.png"]);
});

test("rewrites known posts and leaves external links alone", () => {
	const slugs = new Set(["example"]);
	assert.equal(rewriteWordPressUrl("https://janwee.blog/example/", slugs), "/posts/example/");
	assert.equal(rewriteWordPressUrl("https://example.com/example/", slugs), "https://example.com/example/");
	assert.equal(rewriteWordPressUrl("https://janwee.blog/about-me/", slugs), "/about/");
});

test("uses a safe code fence when code contains backticks", () => {
	const fenced = fenceCode("const value = ```example```;", "javascript");
	assert.match(fenced, /^````js\n/);
	assert.match(fenced, /\n````$/);
});

test("uses the selected category override for the singleton article", () => {
	assert.equal(
		selectCategory({
			slug: "thread-safe-implementations-of-java-singleton-design-pattern",
			categories: [{ id: 14, name: "JAVA", slug: "java" }, { id: 124, name: "设计模式", slug: "design-pattern" }],
			seo: { primary_category: 1 },
		}),
		"设计模式",
	);
});

test("removes an encoded blockquote epigraph from generated descriptions", () => {
	assert.equal(
		textDescription(
			{ excerpt: "", seo: { description: "" } },
			"> &#62; 题记\n>\n> — 作者\n\n## 简介\n\n这是文章摘要。",
		),
		"简介 这是文章摘要。",
	);
});
