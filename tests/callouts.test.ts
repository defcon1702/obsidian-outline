import { convertCallouts, CalloutTransformer } from "../src/plugins";
import { createContext, runPipeline } from "../src/plugins";

describe("convertCallouts", () => {
	it("converts a single-line warning callout", () => {
		const input = "> [!WARNING] Watch out!";
		const output = convertCallouts(input);
		expect(output).toBe(":::warning\nWatch out!\n\n:::");
	});

	it("converts a multi-line callout with body", () => {
		const input = [
			"> [!NOTE] Important",
			"> First line of body",
			"> Second line of body",
		].join("\n");
		const output = convertCallouts(input);
		expect(output).toBe(
			[":::info", "Important", "First line of body", "Second line of body", "", ":::"].join("\n"),
		);
	});

	it("handles callout with no custom title", () => {
		const input = ["> [!WARNING]", "> Some warning text"].join("\n");
		const output = convertCallouts(input);
		expect(output).toBe([":::warning", "Some warning text", "", ":::"].join("\n"));
	});

	it("handles callout with empty body", () => {
		const input = "> [!INFO]";
		const output = convertCallouts(input);
		expect(output).toBe(":::info\n\n:::");
	});

	it("maps all Obsidian types to correct Outline types", () => {
		const mappings: [string, string][] = [
			["NOTE", "info"],
			["ABSTRACT", "info"],
			["INFO", "info"],
			["TIP", "tip"],
			["SUCCESS", "success"],
			["QUESTION", "info"],
			["WARNING", "warning"],
			["FAILURE", "warning"],
			["DANGER", "warning"],
			["BUG", "warning"],
			["EXAMPLE", "tip"],
			["QUOTE", "info"],
			["CITE", "info"],
		];
		for (const [obsidian, outline] of mappings) {
			const output = convertCallouts(`> [!${obsidian}] test`);
			expect(output).toContain(`:::${outline}`);
		}
	});

	it("maps unknown callout types to info", () => {
		const output = convertCallouts("> [!CUSTOM] something");
		expect(output).toContain(":::info");
	});

	it("ignores foldable +/- markers", () => {
		const foldPlus = convertCallouts("> [!NOTE]+ Collapsible title");
		expect(foldPlus).toContain(":::info");
		expect(foldPlus).toContain("Collapsible title");

		const foldMinus = convertCallouts("> [!WARNING]- Collapsed");
		expect(foldMinus).toContain(":::warning");
		expect(foldMinus).toContain("Collapsed");
	});

	it("handles multiple sequential callouts separated by blank line", () => {
		const input = [
			"> [!WARNING]",
			"> warn text",
			"",
			"> [!SUCCESS]",
			"> success text",
		].join("\n");
		const output = convertCallouts(input);
		expect(output).toContain(":::warning");
		expect(output).toContain("warn text");
		expect(output).toContain(":::success");
		expect(output).toContain("success text");
	});

	it("does NOT eat the paragraph following a callout", () => {
		const input = [
			"> [!NOTE]",
			"> callout body",
			"This is a normal paragraph",
		].join("\n");
		const output = convertCallouts(input);
		expect(output).toContain(":::info");
		expect(output).toContain("callout body");
		expect(output).toContain("This is a normal paragraph");
		const lines = output.split("\n");
		const paragraphLine = lines.find((l) => l === "This is a normal paragraph");
		expect(paragraphLine).toBeDefined();
	});

	it("leaves regular blockquotes untouched", () => {
		const input = "> This is just a regular blockquote";
		const output = convertCallouts(input);
		expect(output).toBe("> This is just a regular blockquote");
	});

	it("leaves nested blockquotes untouched", () => {
		const input = ["> line one", "> line two", "> line three"].join("\n");
		const output = convertCallouts(input);
		expect(output).toBe(input);
	});

	it("handles callout with blank continuation line", () => {
		const input = [
			"> [!INFO] Title",
			"> First paragraph",
			">",
			"> Second paragraph",
		].join("\n");
		const output = convertCallouts(input);
		expect(output).toContain(":::info");
		expect(output).toContain("Title");
		expect(output).toContain("First paragraph");
		expect(output).toContain("Second paragraph");
	});

	it("produces Outline import format matching Test Collection.md", () => {
		const input = [
			"> [!WARNING]",
			"> This is a warning",
		].join("\n");
		const output = convertCallouts(input);
		expect(output).toBe(
			[":::warning", "This is a warning", "", ":::"].join("\n"),
		);
	});

	it("works correctly through the pipeline", () => {
		const ctx = createContext("> [!SUCCESS]\n> Deployed successfully");
		const result = runPipeline(ctx, [CalloutTransformer()]);
		expect(result.content).toContain(":::success");
		expect(result.content).toContain("Deployed successfully");
	});

	it("handles case-insensitive callout types", () => {
		const lower = convertCallouts("> [!warning] test");
		const upper = convertCallouts("> [!WARNING] test");
		const mixed = convertCallouts("> [!Warning] test");
		expect(lower).toBe(upper);
		expect(upper).toBe(mixed);
	});
});
