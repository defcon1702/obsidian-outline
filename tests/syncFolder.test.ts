import { syncFolder } from "../src/sync/sync";
import type { SyncOptions, SyncEnv, FileDescriptor } from "../src/sync/types";
import type { IOutlineApi, OutlineDocument, OutlineCollection, AttachmentCreateResult } from "../src/outline-api/types";

function makeFakeApi(): IOutlineApi & {
	created: { title: string; parentDocumentId?: string; text: string }[];
	updated: { id: string; title: string; text: string }[];
} {
	let nextId = 1;
	const docs = new Map<string, OutlineDocument>();

	const api: ReturnType<typeof makeFakeApi> = {
		created: [],
		updated: [],
		async validateAuth() {
			return "Test User";
		},
		async listCollections(): Promise<OutlineCollection[] | null> {
			return [];
		},
		async getDocument(id: string) {
			return docs.get(id) ?? null;
		},
		async createDocument(params) {
			const doc: OutlineDocument = {
				id: `doc-${nextId++}`,
				title: params.title,
				text: params.text,
				url: `/doc/${nextId}`,
				collectionId: params.collectionId,
				parentDocumentId: params.parentDocumentId,
				updatedAt: new Date().toISOString(),
			};
			docs.set(doc.id, doc);
			api.created.push({
				title: params.title,
				parentDocumentId: params.parentDocumentId,
				text: params.text,
			});
			return doc;
		},
		async updateDocument(params) {
			const doc = docs.get(params.id);
			if (!doc) return null;
			doc.title = params.title;
			doc.text = params.text;
			api.updated.push({ id: params.id, title: params.title, text: params.text });
			return doc;
		},
		async searchDocumentByTitle(_title, _collectionId, _parentDocumentId) {
			return null;
		},
		async createAttachment() {
			return null;
		},
		async uploadAttachmentToStorage() {
			return false;
		},
	};
	return api;
}

function makeEnv(
	api: IOutlineApi,
	fileContents: Record<string, string>,
): SyncEnv {
	const files: FileDescriptor[] = Object.keys(fileContents).map((relPath) => ({
		path: relPath,
		basename: relPath.split("/").pop()!.replace(/\.md$/, ""),
		relativePath: relPath,
	}));

	return {
		api,
		async listMarkdownFiles() {
			return files;
		},
		async readFile(fd) {
			return fileContents[fd.relativePath ?? fd.path] ?? "";
		},
		getWikiResolver() {
			return () => null;
		},
		resolveImage() {
			return null;
		},
		async readImageBytes() {
			return new ArrayBuffer(0);
		},
		async writeFrontmatter() {},
	};
}

const defaultOptions: SyncOptions = {
	outlineUrl: "https://example.com",
	apiKey: "test-key",
	collectionId: "col-1",
	removeToc: false,
	indexAsFolder: true,
	folderConflictStrategy: "overwrite",
};

describe("syncFolder", () => {
	it("index.md files should use the folder name as document title, not 'index'", async () => {
		const api = makeFakeApi();
		const env = makeEnv(api, {
			"Export/index.md": "# Export content",
			"Export/Buchhaltung/index.md": "# Buchhaltung content",
			"Export/Buchhaltung/Einleitung.md": "# Einleitung",
		});

		await syncFolder(defaultOptions, env, "/root");

		const titles = api.created.map((d) => d.title);
		expect(titles).toContain("Export");
		expect(titles).toContain("Buchhaltung");
		expect(titles).toContain("Einleitung");
		expect(titles).not.toContain("index");
	});

	it("folder hierarchy should be preserved via parentDocumentId", async () => {
		const api = makeFakeApi();
		const env = makeEnv(api, {
			"Export/index.md": "# Export",
			"Export/Buchhaltung/index.md": "# Buchhaltung",
			"Export/Buchhaltung/Einleitung.md": "# Einleitung",
		});

		await syncFolder(defaultOptions, env, "/root");

		const exportDoc = api.created.find((d) => d.title === "Export")!;
		expect(exportDoc.parentDocumentId).toBeUndefined();

		const buchDoc = api.created.find((d) => d.title === "Buchhaltung")!;
		expect(buchDoc.parentDocumentId).toBeDefined();

		const einleitungDoc = api.created.find((d) => d.title === "Einleitung")!;
		expect(einleitungDoc.parentDocumentId).toBeDefined();
		expect(einleitungDoc.parentDocumentId).not.toEqual(exportDoc.parentDocumentId);
	});

	it("folders without index.md should create placeholder documents to preserve hierarchy", async () => {
		const api = makeFakeApi();
		const env = makeEnv(api, {
			"Export/index.md": "# Export",
			"Export/Rechnungsportal/Ablastungen.md": "# Ablastungen",
		});

		await syncFolder(defaultOptions, env, "/root");

		const titles = api.created.map((d) => d.title);
		expect(titles).toContain("Export");
		expect(titles).toContain("Rechnungsportal");
		expect(titles).toContain("Ablastungen");

		const rechnungsportal = api.created.find((d) => d.title === "Rechnungsportal")!;
		expect(rechnungsportal).toBeDefined();

		const ablastungen = api.created.find((d) => d.title === "Ablastungen")!;
		expect(ablastungen.parentDocumentId).toBeDefined();
	});

	it("deeply nested folders without index.md create proper chain of placeholders", async () => {
		const api = makeFakeApi();
		const env = makeEnv(api, {
			"A/B/C/leaf.md": "# leaf",
		});

		await syncFolder(defaultOptions, env, "/root");

		const titles = api.created.map((d) => d.title);
		expect(titles).toEqual(expect.arrayContaining(["A", "B", "C", "leaf"]));

		const aDoc = api.created.find((d) => d.title === "A")!;
		const bDoc = api.created.find((d) => d.title === "B")!;
		const cDoc = api.created.find((d) => d.title === "C")!;
		const leafDoc = api.created.find((d) => d.title === "leaf")!;

		expect(aDoc.parentDocumentId).toBeUndefined();
		expect(bDoc.parentDocumentId).toBeDefined();
		expect(cDoc.parentDocumentId).toBeDefined();
		expect(leafDoc.parentDocumentId).toBeDefined();
	});

	it("real-world vault structure produces correct hierarchy", async () => {
		const api = makeFakeApi();
		const env = makeEnv(api, {
			"Export/index.md": "# Export",
			"Export/Buchhaltung/index.md": "# Buchhaltung",
			"Export/Buchhaltung/Masterdata Doku/Einleitung.md": "# Einleitung",
			"Export/Buchhaltung/Rechnungsportal/Ablastungen.md": "# Ablastungen",
			"Export/Digitale Akte/index.md": "# Digitale Akte",
			"Export/Digitale Akte/Contract-Management.md": "# Contract-Management",
			"Export/Kommunikation/index.md": "# Kommunikation",
			"Export/Kommunikation/MS Teams.md": "# MS Teams",
			"Export/Kommunikation/Externe User/Externe User.md": "# Externe User",
			"Export/Templates/Template.md": "# Template",
		});

		await syncFolder(defaultOptions, env, "/root");

		const titles = api.created.map((d) => d.title);
		expect(titles).not.toContain("index");
		expect(titles).toContain("Export");
		expect(titles).toContain("Buchhaltung");
		expect(titles).toContain("Digitale Akte");
		expect(titles).toContain("Kommunikation");
		expect(titles).toContain("Masterdata Doku");
		expect(titles).toContain("Rechnungsportal");
		expect(titles).toContain("Externe User");
		expect(titles).toContain("Templates");
	});
});
