/**
 * Re-exports generated types and defines the IOutlineApi abstraction.
 *
 * Domain aliases provide stronger contracts (required fields) than
 * the raw OpenAPI types where almost everything is optional.
 */

import type {
	Collection,
	Document,
	Attachment,
	AttachmentsCreate200Data,
} from "./generated-client/outlineAPI";

export type { Collection, Document, Attachment };

export type OutlineCollection = Required<Pick<Collection, "id" | "name">> &
	Pick<Collection, "description" | "color" | "urlId">;

export type OutlineDocument = Required<Pick<Document, "id" | "title" | "text" | "collectionId">> &
	Pick<Document, "parentDocumentId" | "updatedAt"> & { url: string };

export interface AttachmentCreateResult {
	uploadUrl: string;
	form: Record<string, string>;
	attachment: {
		id: string;
		url: string;
	};
}

export interface IOutlineApi {
	/** Returns the authenticated user's name, or null on failure. */
	validateAuth(): Promise<string | null>;
	listCollections(): Promise<OutlineCollection[] | null>;
	getDocument(id: string): Promise<OutlineDocument | null>;
	createDocument(params: {
		title: string;
		text: string;
		collectionId: string;
		publish: boolean;
		parentDocumentId?: string;
	}): Promise<OutlineDocument | null>;
	updateDocument(params: {
		id: string;
		title: string;
		text: string;
		publish: boolean;
	}): Promise<OutlineDocument | null>;
	searchDocumentByTitle(
		title: string,
		collectionId: string,
		parentDocumentId?: string,
	): Promise<OutlineDocument | null>;
	createAttachment(params: {
		name: string;
		contentType: string;
		size: number;
		documentId?: string;
	}): Promise<AttachmentCreateResult | null>;
	uploadAttachmentToStorage(
		uploadUrl: string,
		form: Record<string, string>,
		fileData: ArrayBuffer,
		contentType: string,
	): Promise<boolean>;
}
