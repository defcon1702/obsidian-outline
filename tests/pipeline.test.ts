import {
	runPipeline,
	createContext,
	FrontmatterTransformer,
	CalloutTransformer,
	WikiLinkTransformer,
	ImageDetector,
	type ImageRef,
} from "../src/plugins";

const knownDocs: Record<string, string> = {
	"Other Note": "uuid-other",
};

function fullPipeline(content: string) {
	const ctx = createContext(content, "Test File", "folder/Test File.md");
	return runPipeline(ctx, [
		FrontmatterTransformer(),
		ImageDetector(),
		WikiLinkTransformer({ resolve: (t) => knownDocs[t] ?? null }),
		CalloutTransformer(),
	]);
}

describe("full pipeline integration", () => {
	it("transforms a complete Obsidian document", () => {
		const input = [
			"---",
			"title: My Note",
			"outline_id: existing-uuid",
			"tags: test",
			"---",
			"# Heading",
			"",
			"Some text with [[Other Note]] link.",
			"",
			"> [!WARNING] Heads up",
			"> This is important",
			"> Really important",
			"",
			"Regular paragraph after callout.",
			"",
			"![[diagram.png]]",
			"",
			"![photo](images/photo.jpg)",
			"",
			"> Just a regular blockquote",
			"> with multiple lines",
		].join("\n");

		const result = fullPipeline(input);

		expect(result.meta.frontmatter["title"]).toBe("My Note");
		expect(result.meta.frontmatter["tags"]).toBe("test");

		expect(result.content).not.toContain("---");
		expect(result.content).not.toContain("title: My Note");

		expect(result.content).toContain("[Other Note](doc:uuid-other)");

		expect(result.content).toContain(":::warning");
		expect(result.content).toContain("Heads up");
		expect(result.content).toContain("This is important");
		expect(result.content).toContain("Really important");
		expect(result.content).toContain(":::");

		expect(result.content).toContain("Regular paragraph after callout.");

		const images = result.meta.plugins["ImageDetector"]?.["images"] as ImageRef[];
		expect(images).toHaveLength(2);
		expect(result.content).toContain("__OUTLINE_IMG_0__");
		expect(result.content).toContain("__OUTLINE_IMG_1__");

		expect(result.content).toContain("> Just a regular blockquote");
		expect(result.content).toContain("> with multiple lines");
	});

	it("preserves code fences untouched", () => {
		const input = [
			"```javascript",
			'const hello = "world";',
			"```",
		].join("\n");
		const result = fullPipeline(input);
		expect(result.content).toBe(input);
	});

	it("preserves mermaid blocks untouched", () => {
		const input = [
			"```mermaid",
			"graph TD",
			"  A --> B",
			"```",
		].join("\n");
		const result = fullPipeline(input);
		expect(result.content).toBe(input);
	});

	it("preserves tables untouched", () => {
		const input = [
			"| Col A | Col B |",
			"|-------|-------|",
			"| val 1 | val 2 |",
		].join("\n");
		const result = fullPipeline(input);
		expect(result.content).toBe(input);
	});

	it("preserves horizontal rules", () => {
		const input = "Above\n\n---\n\nBelow";
		const result = fullPipeline(input);
		expect(result.content).toBe(input);
	});

	it("handles empty document", () => {
		const result = fullPipeline("");
		expect(result.content).toBe("");
	});

	it("handles document with only frontmatter", () => {
		const input = "---\ntitle: Only FM\n---\n";
		const result = fullPipeline(input);
		expect(result.content).toBe("");
		expect(result.meta.frontmatter["title"]).toBe("Only FM");
	});

	it("preserves checklists", () => {
		const input = "- [x] Done\n- [ ] Not done";
		const result = fullPipeline(input);
		expect(result.content).toBe(input);
	});

	it("handles multiple transformations in sequence correctly", () => {
		const input = [
			"---",
			"outline_id: doc-123",
			"---",
			"# Title",
			"",
			"Link to [[Other Note]].",
			"",
			"> [!TIP] Pro tip",
			"> Use the pipeline!",
			"",
			"![[screenshot.png]]",
		].join("\n");

		const result = fullPipeline(input);

		expect(result.content).not.toContain("outline_id");
		expect(result.content).toContain("[Other Note](doc:uuid-other)");
		expect(result.content).toContain(":::tip");
		expect(result.content).toContain("Pro tip");
		expect(result.content).toContain("Use the pipeline!");

		const images = result.meta.plugins["ImageDetector"]?.["images"] as ImageRef[];
		expect(images).toHaveLength(1);
		expect(images[0].imageName).toBe("screenshot.png");
	});

	it("matches Test Collection.md Outline callout format", () => {
		const obsidianInput = [
			"> [!WARNING]",
			"> This is a warning",
			"",
			"> [!INFO]",
			"> This is an info",
			"",
			"> [!SUCCESS]",
			"> success note",
			"",
			"> [!TIP]",
			"> success note",
		].join("\n");

		const result = fullPipeline(obsidianInput);

		const expectedOutline = [
			":::warning",
			"This is a warning",
			"",
			":::",
			"",
			":::info",
			"This is an info",
			"",
			":::",
			"",
			":::success",
			"success note",
			"",
			":::",
			"",
			":::tip",
			"success note",
			"",
			":::",
		].join("\n");

		expect(result.content).toBe(expectedOutline);
	});
});
