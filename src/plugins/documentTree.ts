export interface DocNode {
	title: string;
	relativePath: string;
	filePath: string | null;
	isFolder: boolean;
	children: DocNode[];
}

export interface TreeOptions {
	indexAsFolder?: boolean;
}

export function buildDocumentTree(
	relativePaths: string[],
	options?: TreeOptions,
): DocNode[] {
	const indexAsFolder = options?.indexAsFolder ?? true;

	const folderMap = new Map<string, DocNode>();

	function getOrCreateFolder(folderPath: string): DocNode {
		const existing = folderMap.get(folderPath);
		if (existing) return existing;

		const title = folderPath.includes("/")
			? folderPath.slice(folderPath.lastIndexOf("/") + 1)
			: folderPath;

		const node: DocNode = {
			title,
			relativePath: folderPath,
			filePath: null,
			isFolder: true,
			children: [],
		};
		folderMap.set(folderPath, node);

		const parentPath = folderPath.includes("/")
			? folderPath.slice(0, folderPath.lastIndexOf("/"))
			: "";

		if (parentPath) {
			const parent = getOrCreateFolder(parentPath);
			parent.children.push(node);
		}

		return node;
	}

	const roots: DocNode[] = [];

	for (const relPath of relativePaths) {
		const normalized = relPath.replace(/\\/g, "/");
		const parts = normalized.split("/");
		const fileName = parts[parts.length - 1];
		const baseName = fileName.replace(/\.md$/, "");
		const dirPath = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

		const isIndex = indexAsFolder && baseName === "index";

		if (isIndex && dirPath) {
			const folderNode = getOrCreateFolder(dirPath);
			folderNode.filePath = normalized;
		} else if (isIndex && !dirPath) {
			const leaf: DocNode = {
				title: "index",
				relativePath: normalized,
				filePath: normalized,
				isFolder: false,
				children: [],
			};
			roots.push(leaf);
		} else {
			const leaf: DocNode = {
				title: baseName,
				relativePath: dirPath ? `${dirPath}/${baseName}` : baseName,
				filePath: normalized,
				isFolder: false,
				children: [],
			};

			if (dirPath) {
				const parent = getOrCreateFolder(dirPath);
				parent.children.push(leaf);
			} else {
				roots.push(leaf);
			}
		}
	}

	for (const [folderPath, node] of folderMap) {
		const isTopLevel = !folderPath.includes("/");
		if (isTopLevel) {
			roots.push(node);
		}
	}

	sortChildren(roots);
	return roots;
}

function sortChildren(nodes: DocNode[]): void {
	nodes.sort((a, b) => {
		if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
		return a.title.localeCompare(b.title);
	});
	for (const node of nodes) {
		if (node.children.length > 0) {
			sortChildren(node.children);
		}
	}
}
