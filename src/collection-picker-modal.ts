import { App, Modal, Setting } from "obsidian";
import type { OutlineCollection } from "./outline-client";

export function pickCollection(
	app: App,
	collections: OutlineCollection[],
	defaultCollectionId: string
): Promise<string | null> {
	return new Promise((resolve) => {
		new CollectionPickerModal(app, collections, defaultCollectionId, resolve).open();
	});
}

class CollectionPickerModal extends Modal {
	private collections: OutlineCollection[];
	private selectedId: string;
	private resolve: (id: string | null) => void;

	constructor(
		app: App,
		collections: OutlineCollection[],
		defaultCollectionId: string,
		resolve: (id: string | null) => void
	) {
		super(app);
		this.collections = collections;
		this.selectedId = defaultCollectionId || (collections[0]?.id ?? "");
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText("Ziel-Collection wählen");

		new Setting(contentEl)
			.setName("Collection")
			.setDesc("Wohin soll das Dokument gepusht werden?")
			.addDropdown((dropdown) => {
				for (const col of this.collections) {
					dropdown.addOption(col.id, col.name);
				}
				dropdown.setValue(this.selectedId);
				dropdown.onChange((value) => {
					this.selectedId = value;
				});
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Push")
					.setCta()
					.onClick(() => {
						this.resolve(this.selectedId);
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Abbrechen")
					.onClick(() => {
						this.resolve(null);
						this.close();
					})
			);

		this.scope.register([], "Enter", () => {
			this.resolve(this.selectedId);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
