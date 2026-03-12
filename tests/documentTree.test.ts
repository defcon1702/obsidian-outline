import { buildDocumentTree, type DocNode } from "../src/pipeline";

function titles(nodes: DocNode[]): string[] {
	return nodes.map((n) => n.title);
}

function findNode(nodes: DocNode[], title: string): DocNode | undefined {
	for (const n of nodes) {
		if (n.title === title) return n;
		const found = findNode(n.children, title);
		if (found) return found;
	}
	return undefined;
}

describe("buildDocumentTree", () => {
	it("single file at root level", () => {
		const tree = buildDocumentTree(["README.md"]);
		expect(tree).toHaveLength(1);
		expect(tree[0]).toMatchObject({
			title: "README",
			filePath: "README.md",
			isFolder: false,
			children: [],
		});
	});

	it("multiple files at root level", () => {
		const tree = buildDocumentTree(["alpha.md", "beta.md"]);
		expect(tree).toHaveLength(2);
		expect(titles(tree)).toEqual(["alpha", "beta"]);
		expect(tree.every((n) => !n.isFolder)).toBe(true);
	});

	it("nested file creates intermediate folder node", () => {
		const tree = buildDocumentTree(["docs/guide.md"]);
		expect(tree).toHaveLength(1);

		const docs = tree[0];
		expect(docs).toMatchObject({
			title: "docs",
			isFolder: true,
			filePath: null,
		});
		expect(docs.children).toHaveLength(1);
		expect(docs.children[0]).toMatchObject({
			title: "guide",
			filePath: "docs/guide.md",
			isFolder: false,
		});
	});

	it("index.md merges into parent folder when indexAsFolder is true", () => {
		const tree = buildDocumentTree(["docs/index.md", "docs/guide.md"]);
		expect(tree).toHaveLength(1);

		const docs = tree[0];
		expect(docs).toMatchObject({
			title: "docs",
			isFolder: true,
			filePath: "docs/index.md",
		});
		expect(docs.children).toHaveLength(1);
		expect(docs.children[0].title).toBe("guide");
	});

	it("index.md becomes regular doc when indexAsFolder is false", () => {
		const tree = buildDocumentTree(["docs/index.md", "docs/guide.md"], {
			indexAsFolder: false,
		});
		expect(tree).toHaveLength(1);

		const docs = tree[0];
		expect(docs.isFolder).toBe(true);
		expect(docs.filePath).toBeNull();
		expect(docs.children).toHaveLength(2);
		expect(titles(docs.children)).toEqual(["guide", "index"]);
	});

	it("root-level index.md stays as regular doc even with indexAsFolder", () => {
		const tree = buildDocumentTree(["index.md", "other.md"]);
		expect(tree).toHaveLength(2);

		const idx = tree.find((n) => n.title === "index");
		expect(idx).toMatchObject({
			title: "index",
			filePath: "index.md",
			isFolder: false,
		});
	});

	it("deeply nested paths (3+ levels)", () => {
		const tree = buildDocumentTree([
			"a/b/c/deep.md",
			"a/b/c/index.md",
			"a/b/mid.md",
		]);

		expect(tree).toHaveLength(1);
		const a = tree[0];
		expect(a.title).toBe("a");
		expect(a.isFolder).toBe(true);

		const b = findNode(a.children, "b");
		expect(b).toBeDefined();
		expect(b!.isFolder).toBe(true);
		expect(b!.children).toHaveLength(2); // folder "c" + file "mid"

		const c = findNode(b!.children, "c");
		expect(c).toBeDefined();
		expect(c!.isFolder).toBe(true);
		expect(c!.filePath).toBe("a/b/c/index.md");
		expect(c!.children).toHaveLength(1);
		expect(c!.children[0].title).toBe("deep");
	});

	it("mixed folders with and without index.md", () => {
		const tree = buildDocumentTree([
			"Export/index.md",
			"Export/Buchhaltung/index.md",
			"Export/Buchhaltung/Einleitung.md",
			"Export/Vertrieb/Sales.md",
		]);

		const exp = tree.find((n) => n.title === "Export");
		expect(exp).toBeDefined();
		expect(exp!.filePath).toBe("Export/index.md");
		expect(exp!.isFolder).toBe(true);

		const buch = findNode(exp!.children, "Buchhaltung");
		expect(buch).toBeDefined();
		expect(buch!.filePath).toBe("Export/Buchhaltung/index.md");
		expect(buch!.children).toHaveLength(1);

		const vertrieb = findNode(exp!.children, "Vertrieb");
		expect(vertrieb).toBeDefined();
		expect(vertrieb!.filePath).toBeNull();
		expect(vertrieb!.children).toHaveLength(1);
		expect(vertrieb!.children[0].title).toBe("Sales");
	});

	it("empty intermediate folders get filePath null", () => {
		const tree = buildDocumentTree(["a/b/c/leaf.md"]);

		const a = tree[0];
		expect(a.filePath).toBeNull();

		const b = a.children[0];
		expect(b.filePath).toBeNull();

		const c = b.children[0];
		expect(c.filePath).toBeNull();
		expect(c.children[0].title).toBe("leaf");
	});

	it("files at root alongside folders", () => {
		const tree = buildDocumentTree([
			"README.md",
			"docs/guide.md",
			"CHANGELOG.md",
		]);

		const folders = tree.filter((n) => n.isFolder);
		const files = tree.filter((n) => !n.isFolder);

		expect(folders).toHaveLength(1);
		expect(folders[0].title).toBe("docs");

		expect(files).toHaveLength(2);
		expect(titles(files)).toEqual(["CHANGELOG", "README"]);
	});

	it("sorts folders before files, then alphabetically", () => {
		const tree = buildDocumentTree([
			"zebra.md",
			"alpha/one.md",
			"beta/two.md",
			"apple.md",
		]);

		expect(titles(tree)).toEqual(["alpha", "beta", "apple", "zebra"]);
	});

	it("handles backslash paths (Windows)", () => {
		const tree = buildDocumentTree(["docs\\guide.md", "docs\\index.md"]);
		expect(tree).toHaveLength(1);
		expect(tree[0].title).toBe("docs");
		expect(tree[0].filePath).toBe("docs/index.md");
		expect(tree[0].children[0].title).toBe("guide");
	});

	it("real-world vault structure (Quartz-style)", () => {
		const tree = buildDocumentTree([
			"Export/index.md",
			"Export/Buchhaltung/index.md",
			"Export/Buchhaltung/Masterdata Doku/Einleitung.md",
			"Export/Buchhaltung/Masterdata Doku/Anlage eines Suppliers/Employee.md",
			"Export/Buchhaltung/Rechnungsportal/Ablastungen.md",
			"Export/Digitale Akte/index.md",
			"Export/Digitale Akte/Contract-Management.md",
			"Export/Kommunikation/index.md",
			"Export/Kommunikation/MS Teams.md",
			"Export/Kommunikation/Externe User/Externe User.md",
		]);

		expect(tree).toHaveLength(1);
		const exp = tree[0];
		expect(exp.title).toBe("Export");
		expect(exp.filePath).toBe("Export/index.md");

		const buch = findNode(exp.children, "Buchhaltung");
		expect(buch!.filePath).toBe("Export/Buchhaltung/index.md");

		const masterdata = findNode(buch!.children, "Masterdata Doku");
		expect(masterdata!.isFolder).toBe(true);
		expect(masterdata!.filePath).toBeNull();

		const anlage = findNode(masterdata!.children, "Anlage eines Suppliers");
		expect(anlage!.isFolder).toBe(true);
		expect(anlage!.children).toHaveLength(1);
		expect(anlage!.children[0].title).toBe("Employee");

		const komm = findNode(exp.children, "Kommunikation");
		expect(komm!.filePath).toBe("Export/Kommunikation/index.md");

		const externe = findNode(komm!.children, "Externe User");
		expect(externe!.isFolder).toBe(true);
		expect(externe!.children).toHaveLength(1);
	});

	it("index.md only in folder (no siblings)", () => {
		const tree = buildDocumentTree(["lonely/index.md"]);
		expect(tree).toHaveLength(1);
		expect(tree[0]).toMatchObject({
			title: "lonely",
			isFolder: true,
			filePath: "lonely/index.md",
			children: [],
		});
	});
});
