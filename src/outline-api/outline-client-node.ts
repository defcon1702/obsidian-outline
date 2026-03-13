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
import type { Collection, Document, AttachmentsCreate200Data } from "./generated-client/outlineAPI";
import type { IOutlineApi } from "./types";

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
			if (res.status !== 200) return null;
			return res.data.data?.user?.name ?? "Unknown";
		} catch {
			return null;
		}
	}

	async listCollections(): Promise<Collection[] | null> {
		try {
			const res = await collectionsList({ limit: 100 });
			if (res.status !== 200) return null;
			return res.data.data ?? null;
		} catch {
			return null;
		}
	}

	async getDocument(id: string): Promise<Document | null> {
		try {
			const res = await documentsInfo({ id });
			if (res.status !== 200) return null;
			return res.data.data ?? null;
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
	}): Promise<Document | null> {
		try {
			const res = await documentsCreate(params);
			if (res.status !== 200) return null;
			return res.data.data ?? null;
		} catch {
			return null;
		}
	}

	async updateDocument(params: {
		id: string;
		title: string;
		text: string;
		publish: boolean;
	}): Promise<Document | null> {
		try {
			const res = await documentsUpdate(params);
			if (res.status !== 200) return null;
			return res.data.data ?? null;
		} catch {
			return null;
		}
	}

	async searchDocumentByTitle(
		title: string,
		collectionId: string,
		parentDocumentId?: string,
	): Promise<Document | null> {
		try {
			const res = await documentsSearch({
				query: title,
				collectionId,
				limit: 25,
			});
			if (res.status !== 200) return null;
			const exact = res.data.data?.find(
				(r) =>
					r.document?.title?.toLowerCase() === title.toLowerCase() &&
					(r.document?.parentDocumentId ?? undefined) === parentDocumentId,
			);
			return exact?.document ?? null;
		} catch {
			return null;
		}
	}

	async createAttachment(params: {
		name: string;
		contentType: string;
		size: number;
		documentId?: string;
	}): Promise<AttachmentsCreate200Data | null> {
		try {
			const res = await attachmentsCreate(params);
			if (res.status !== 200) return null;
			return res.data.data ?? null;
		} catch {
			return null;
		}
	}

	async uploadAttachmentToStorage(
		uploadUrl: string,
		form: Record<string, unknown>,
		fileData: ArrayBuffer,
		contentType: string,
	): Promise<boolean> {
		const absoluteUrl = uploadUrl.startsWith("http")
			? uploadUrl
			: `${this.baseUrl}${uploadUrl.startsWith("/") ? "" : "/"}${uploadUrl}`;

		const formData = new FormData();
		for (const [key, value] of Object.entries(form)) {
			formData.append(key, String(value));
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
