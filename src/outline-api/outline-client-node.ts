import { OutlineApiBase } from "./outline-api-base";

export class OutlineClientNode extends OutlineApiBase {
	constructor(baseUrl: string, apiKey: string) {
		super(baseUrl, apiKey);
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
