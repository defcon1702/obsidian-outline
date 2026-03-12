import {
	replaceWikiLinks,
	WikiLinkTransformer,
	createContext,
	runPipeline,
} from "../src/plugins";

const knownDocs: Record<string, string> = {
	"My Page": "uuid-my-page",
	"Another Note": "uuid-another",
	"Project Plan": "uuid-project",
};

const resolver = (target: string) => knownDocs[target] ?? null;

describe("replaceWikiLinks", () => {
	it("resolves a simple wiki link", () => {
		const output = replaceWikiLinks("See [[My Page]] for details", resolver);
		expect(output).toBe("See [My Page](doc:uuid-my-page) for details");
	});

	it("uses alias as display text", () => {
		const output = replaceWikiLinks("Check [[My Page|the page]]", resolver);
		expect(output).toBe("Check [the page](doc:uuid-my-page)");
	});

	it("strips heading fragment from link target", () => {
		const output = replaceWikiLinks("See [[My Page#section]]", resolver);
		expect(output).toBe("See [My Page](doc:uuid-my-page)");
	});

	it("strips heading fragment and uses alias", () => {
		const output = replaceWikiLinks("See [[My Page#section|alias]]", resolver);
		expect(output).toBe("See [alias](doc:uuid-my-page)");
	});

	it("converts unresolved link to plain text", () => {
		const output = replaceWikiLinks("See [[Unknown Page]]", resolver);
		expect(output).toBe("See Unknown Page");
	});

	it("handles multiple links on one line", () => {
		const output = replaceWikiLinks(
			"Compare [[My Page]] and [[Another Note]]",
			resolver,
		);
		expect(output).toBe(
			"Compare [My Page](doc:uuid-my-page) and [Another Note](doc:uuid-another)",
		);
	});

	it("handles a mix of resolved and unresolved links", () => {
		const output = replaceWikiLinks(
			"[[My Page]] and [[Missing]] and [[Project Plan]]",
			resolver,
		);
		expect(output).toBe(
			"[My Page](doc:uuid-my-page) and Missing and [Project Plan](doc:uuid-project)",
		);
	});

	it("leaves non-wiki-link content unchanged", () => {
		const input = "No links here, just [regular](http://example.com) markdown";
		const output = replaceWikiLinks(input, resolver);
		expect(output).toBe(input);
	});

	it("handles links with no resolver (all become plain text)", () => {
		const output = replaceWikiLinks("[[My Page]]", () => null);
		expect(output).toBe("My Page");
	});
});

describe("WikiLinkTransformer", () => {
	it("works through the pipeline", () => {
		const ctx = createContext("See [[My Page]] for info");
		const result = runPipeline(ctx, [
			WikiLinkTransformer({ resolve: resolver }),
		]);
		expect(result.content).toBe("See [My Page](doc:uuid-my-page) for info");
	});

	it("uses default resolver (no resolution) when no options provided", () => {
		const ctx = createContext("See [[My Page]] for info");
		const result = runPipeline(ctx, [WikiLinkTransformer()]);
		expect(result.content).toBe("See My Page for info");
	});
});
