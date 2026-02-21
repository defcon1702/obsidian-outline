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

		this.titleEl.setText("Dokument bereits vorhanden");

		contentEl.createEl("p", {
			text: `„${this.title}" existiert bereits in Outline. Was soll passieren?`,
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Überschreiben")
					.setCta()
					.onClick(() => {
						this.resolve("overwrite");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Duplikat anlegen")
					.onClick(() => {
						this.resolve("duplicate");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Abbrechen")
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

		this.titleEl.setText("Konflikt-Strategie für Ordner-Push");

		contentEl.createEl("p", {
			text: "Was soll passieren, wenn ein Dokument mit gleichem Titel bereits in Outline existiert?",
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Alle überschreiben")
					.setCta()
					.onClick(() => {
						this.resolve("overwrite");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Duplikate anlegen")
					.onClick(() => {
						this.resolve("duplicate");
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Abbrechen")
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
