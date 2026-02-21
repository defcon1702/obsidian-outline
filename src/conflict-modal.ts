import { App, Modal, Setting } from "obsidian";

export type ConflictResolution = "overwrite" | "duplicate" | "cancel";
export type FolderConflictStrategy = "overwrite" | "duplicate" | "cancel";

export function resolveConflict(
	app: App,
	title: string
): Promise<ConflictResolution> {
	return new Promise((resolve) => {
		new ConflictModal(app, title, resolve).open();
	});
}

export function resolveFolderConflictStrategy(
	app: App
): Promise<FolderConflictStrategy> {
	return new Promise((resolve) => {
		new FolderConflictStrategyModal(app, resolve).open();
	});
}

class ConflictModal extends Modal {
	private title: string;
	private resolve: (r: ConflictResolution) => void;

	constructor(app: App, title: string, resolve: (r: ConflictResolution) => void) {
		super(app);
		this.title = title;
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText("Document already exists");

		contentEl.createEl("p", {
			text: `"${this.title}" already exists in Outline. What would you like to do?`,
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Overwrite")
					.setCta()
					.onClick(() => {
						this.resolve("overwrite");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create duplicate")
					.onClick(() => {
						this.resolve("duplicate");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.resolve("cancel");
						this.close();
					})
			);

		this.scope.register([], "Escape", () => {
			this.resolve("cancel");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class FolderConflictStrategyModal extends Modal {
	private resolve: (r: FolderConflictStrategy) => void;

	constructor(app: App, resolve: (r: FolderConflictStrategy) => void) {
		super(app);
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText("Conflict strategy for folder push");

		contentEl.createEl("p", {
			text: "What should happen when a document with the same title already exists in Outline?",
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Overwrite all")
					.setCta()
					.onClick(() => {
						this.resolve("overwrite");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create duplicates")
					.onClick(() => {
						this.resolve("duplicate");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.resolve("cancel");
						this.close();
					})
			);

		this.scope.register([], "Escape", () => {
			this.resolve("cancel");
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
