import { configure } from "./custom-instance";
import {
	authInfo,
	collectionsList,
	documentsInfo,
	documentsCreate,
	documentsUpdate,
	documentsSearch,
	attachmentsCreate,
} from "./generated-client/outlineAPI";
import type { IOutlineApi, OutlineCollection, OutlineDocument, AttachmentCreateResult } from "./types";

export class OutlineClientNode implements IOutlineApi {
	private baseUrl: string;
	private apiKey: string;

	constructor(baseUrl: string, apiKey: string) {
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.apiKey = apiKey;
		configure({ baseUrl: this.baseUrl, apiKey: this.apiKey });
	}

	async validateAuth(): Promise<string | null> {
		try {
			const res = await authInfo();
			if (res.status !== 200 || !("data" in res.data)) return null;
			const user = (res.data as { data?: { user?: { name?: string } } }).data?.user;
			return user?.name ?? "Unknown";
		} catch {
			return null;
		}
	}

	async listCollections(): Promise<OutlineCollection[] | null> {
		try {
			const res = await collectionsList({ limit: 100 });
			if (res.status !== 200 || !res.data?.data) return null;
			return res.data.data as OutlineCollection[];
		} catch {
			return null;
		}
	}

	async getDocument(id: string): Promise<OutlineDocument | null> {
		try {
			const res = await documentsInfo({ id });
			if (res.status !== 200 || !res.data?.data) return null;
			return res.data.data as unknown as OutlineDocument;
		} catch {
			return null;
		}
	}

	async createDocument(params: {
		title: string;
		text: string;
		collectionId: string;
		publish: boolean;
		parentDocumentId?: string;
	}): Promise<OutlineDocument | null> {
		try {
			const res = await documentsCreate(params);
			if (res.status !== 200 || !res.data?.data) return null;
			return res.data.data as unknown as OutlineDocument;
		} catch {
			return null;
		}
	}

	async updateDocument(params: {
		id: string;
		title: string;
		text: string;
		publish: boolean;
	}): Promise<OutlineDocument | null> {
		try {
			const res = await documentsUpdate(params);
			if (res.status !== 200 || !res.data?.data) return null;
			return res.data.data as unknown as OutlineDocument;
		} catch {
			return null;
		}
	}

	async searchDocumentByTitle(
		title: string,
		collectionId: string,
		parentDocumentId?: string,
	): Promise<OutlineDocument | null> {
		try {
			const res = await documentsSearch({
				query: title,
				collectionId,
				limit: 25,
			});
			if (res.status !== 200 || !res.data?.data) return null;
			const exact = res.data.data.find(
				(r) =>
					r.document?.title?.toLowerCase() === title.toLowerCase() &&
					(r.document?.parentDocumentId ?? undefined) === parentDocumentId,
			);
			return (exact?.document as unknown as OutlineDocument) ?? null;
		} catch {
			return null;
		}
	}

	async createAttachment(params: {
		name: string;
		contentType: string;
		size: number;
		documentId?: string;
	}): Promise<AttachmentCreateResult | null> {
		try {
			const res = await attachmentsCreate(params);
			if (res.status !== 200 || !res.data?.data) return null;
			return res.data.data as unknown as AttachmentCreateResult;
		} catch {
			return null;
		}
	}

	async uploadAttachmentToStorage(
		uploadUrl: string,
		form: Record<string, string>,
		fileData: ArrayBuffer,
		contentType: string,
	): Promise<boolean> {
		const absoluteUrl = uploadUrl.startsWith("http")
			? uploadUrl
			: `${this.baseUrl}${uploadUrl.startsWith("/") ? "" : "/"}${uploadUrl}`;

		const formData = new FormData();
		for (const [key, value] of Object.entries(form)) {
			formData.append(key, value);
		}
		formData.append("file", new Blob([fileData], { type: contentType }), "upload");

		const headers: Record<string, string> = {};
		if (!uploadUrl.startsWith("http")) {
			headers["Authorization"] = `Bearer ${this.apiKey}`;
		}

		try {
			const res = await fetch(absoluteUrl, {
				method: "POST",
				headers,
				body: formData,
			});
			return res.ok;
		} catch {
			return false;
		}
	}
}
