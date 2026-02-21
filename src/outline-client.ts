import { requestUrl, RequestUrlParam, RequestUrlResponse } from "obsidian";

export interface OutlineCollection {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
}

export interface OutlineDocument {
	id: string;
	title: string;
	text: string;
	url: string;
	collectionId: string;
	parentDocumentId: string | null;
	updatedAt: string;
}

export interface AttachmentCreateResult {
	uploadUrl: string;
	form: Record<string, string>;
	attachment: {
		id: string;
		url: string;
	};
}

export class OutlineClient {
	private baseUrl: string;
	private apiKey: string;

	constructor(baseUrl: string, apiKey: string) {
		try {
			const parsed = new URL(baseUrl);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				throw new Error("Ungültiges Protokoll");
			}
			this.baseUrl = parsed.origin;
		} catch {
			this.baseUrl = baseUrl.replace(/\/$/, "");
		}
		this.apiKey = apiKey;
	}

	private async request<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T | null> {
		const maxRetries = 3;
		let attempt = 0;

		while (attempt < maxRetries) {
			const params: RequestUrlParam = {
				url: `${this.baseUrl}/api/${endpoint}`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
					"Accept": "application/json",
				},
				body: JSON.stringify(body),
				throw: false,
			};

			const response = await requestUrl(params);

			if (response.status === 429) {
				const raw = parseInt(response.headers["retry-after"] ?? "5", 10);
				const retryAfter = Math.min(isNaN(raw) ? 5 : raw, 60);
				await sleep(retryAfter * 1000);
				attempt++;
				continue;
			}

			if (response.status >= 400) {
				console.error(`[Outline Sync] API error ${response.status} on ${endpoint}`);
				return null;
			}

			return response.json as T;
		}

		return null;
	}

	async validateAuth(): Promise<boolean> {
		const result = await this.request<{ data: { user: { id: string } } }>("auth.info");
		return result !== null && !!result.data?.user?.id;
	}

	async listCollections(): Promise<OutlineCollection[] | null> {
		const result = await this.request<{ data: OutlineCollection[] }>("collections.list", { limit: 100 });
		return result?.data ?? null;
	}

	async getDocument(id: string): Promise<OutlineDocument | null> {
		const result = await this.request<{ data: OutlineDocument }>("documents.info", { id });
		return result?.data ?? null;
	}

	async createDocument(params: {
		title: string;
		text: string;
		collectionId: string;
		publish: boolean;
		parentDocumentId?: string;
	}): Promise<OutlineDocument | null> {
		const result = await this.request<{ data: OutlineDocument }>("documents.create", params);
		return result?.data ?? null;
	}

	async updateDocument(params: {
		id: string;
		title: string;
		text: string;
		publish: boolean;
	}): Promise<OutlineDocument | null> {
		const result = await this.request<{ data: OutlineDocument }>("documents.update", params);
		return result?.data ?? null;
	}

	async searchDocumentByTitle(title: string, collectionId: string): Promise<OutlineDocument | null> {
		const result = await this.request<{ data: { document: OutlineDocument }[] }>("documents.search", {
			query: title,
			collectionId,
			limit: 10,
		});
		if (!result?.data) return null;
		const exact = result.data.find(
			(item) => item.document.title.toLowerCase() === title.toLowerCase()
		);
		return exact?.document ?? null;
	}

	async createAttachment(params: {
		name: string;
		contentType: string;
		size: number;
		documentId?: string;
	}): Promise<AttachmentCreateResult | null> {
		const result = await this.request<{ data: AttachmentCreateResult }>("attachments.create", params);
		return result?.data ?? null;
	}

	async uploadAttachmentToStorage(uploadUrl: string, form: Record<string, string>, fileData: ArrayBuffer, contentType: string): Promise<boolean> {
		try {
			const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
			const parts: Uint8Array[] = [];
			const enc = new TextEncoder();

			for (const [key, value] of Object.entries(form)) {
				parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
			}
			parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload"\r\nContent-Type: ${contentType}\r\n\r\n`));
			parts.push(new Uint8Array(fileData));
			parts.push(enc.encode(`\r\n--${boundary}--\r\n`));

			const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
			const body = new Uint8Array(totalLength);
			let offset = 0;
			for (const part of parts) {
				body.set(part, offset);
				offset += part.byteLength;
			}

			const response: RequestUrlResponse = await requestUrl({
				url: uploadUrl,
				method: "POST",
				headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
				body: body.buffer,
				throw: false,
			});
			return response.status >= 200 && response.status < 300;
		} catch (e) {
			console.error("[Outline Sync] Attachment upload failed");
			return false;
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
