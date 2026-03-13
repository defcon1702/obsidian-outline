import { requestUrl, type RequestUrlParam } from "obsidian";
import { configure, type Transport } from "./outline-api/custom-instance";
import {
	authInfo,
	collectionsList,
	documentsInfo,
	documentsCreate,
	documentsUpdate,
	documentsSearch,
	attachmentsCreate,
} from "./outline-api/generated-client/outlineAPI";
import type { Collection, Document, AttachmentsCreate200Data } from "./outline-api/generated-client/outlineAPI";
import type { IOutlineApi } from "./outline-api/types";

export type { Collection, Document, AttachmentsCreate200Data };

/**
 * Transport adapter that bridges Obsidian's `requestUrl` to the
 * generic transport interface used by the custom-instance.
 */
const obsidianTransport: Transport = async (url, init) => {
	const params: RequestUrlParam = {
		url,
		method: init.method,
		headers: init.headers,
		body: init.body,
		throw: false,
	};

	const response = await requestUrl(params);

	return {
		status: response.status,
		headers: new Headers(response.headers),
		json: async () => response.json,
	};
};

export class OutlineClient implements IOutlineApi {
	private baseUrl: string;
	private apiKey: string;

	constructor(baseUrl: string, apiKey: string) {
		try {
			const parsed = new URL(baseUrl);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				throw new Error("Invalid protocol");
			}
			this.baseUrl = parsed.origin;
		} catch {
			this.baseUrl = baseUrl.replace(/\/$/, "");
		}
		this.apiKey = apiKey;
		configure({ baseUrl: this.baseUrl, apiKey: this.apiKey, transport: obsidianTransport });
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
		try {
			const isLocalStorage = !uploadUrl.startsWith("http");
			const absoluteUrl = isLocalStorage
				? `${this.baseUrl}${uploadUrl.startsWith("/") ? "" : "/"}${uploadUrl}`
				: uploadUrl;

			const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
			const parts: Uint8Array[] = [];
			const enc = new TextEncoder();

			for (const [key, value] of Object.entries(form)) {
				parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${String(value)}\r\n`));
			}
			parts.push(
				enc.encode(
					`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload"\r\nContent-Type: ${contentType}\r\n\r\n`,
				),
			);
			parts.push(new Uint8Array(fileData));
			parts.push(enc.encode(`\r\n--${boundary}--\r\n`));

			const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
			const body = new Uint8Array(totalLength);
			let offset = 0;
			for (const part of parts) {
				body.set(part, offset);
				offset += part.byteLength;
			}

			const headers: Record<string, string> = {
				"Content-Type": `multipart/form-data; boundary=${boundary}`,
			};
			if (isLocalStorage) {
				headers["Authorization"] = `Bearer ${this.apiKey}`;
			}

			const response = await requestUrl({
				url: absoluteUrl,
				method: "POST",
				headers,
				body: body.buffer,
				throw: false,
			});
			return response.status >= 200 && response.status < 300;
		} catch (e) {
			console.error("[Outline Sync] Attachment upload exception:", e);
			return false;
		}
	}
}
