import { App, Modal, Setting } from "obsidian";
import type { ConflictResolution } from "../sync/types";

export type { ConflictResolution };
export type FolderConflictStrategy = ConflictResolution;

interface ChoiceButton<T> {
	label: string;
	value: T;
	cta?: boolean;
}

class ChoiceModal<T> extends Modal {
	private heading: string;
	private message: string;
	private buttons: ChoiceButton<T>[];
	private resolve: (r: T) => void;
	private fallback: T;

	constructor(
		app: App,
		opts: {
			heading: string;
			message: string;
			buttons: ChoiceButton<T>[];
			fallback: T;
		},
		resolve: (r: T) => void,
	) {
		super(app);
		this.heading = opts.heading;
		this.message = opts.message;
		this.buttons = opts.buttons;
		this.fallback = opts.fallback;
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText(this.heading);
		contentEl.createEl("p", { text: this.message });

		const setting = new Setting(contentEl);
		for (const btn of this.buttons) {
			setting.addButton((b) => {
				b.setButtonText(btn.label).onClick(() => {
					this.resolve(btn.value);
					this.close();
				});
				if (btn.cta) b.setCta();
				return b;
			});
		}

		this.scope.register([], "Escape", () => {
			this.resolve(this.fallback);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export function resolveConflict(
	app: App,
	title: string,
): Promise<ConflictResolution> {
	return new Promise((resolve) => {
		new ChoiceModal<ConflictResolution>(
			app,
			{
				heading: "Document already exists",
				message: `"${title}" already exists in Outline. What would you like to do?`,
				buttons: [
					{ label: "Overwrite", value: "overwrite", cta: true },
					{ label: "Create duplicate", value: "duplicate" },
					{ label: "Cancel", value: "cancel" },
				],
				fallback: "cancel",
			},
			resolve,
		).open();
	});
}

export function resolveFolderConflictStrategy(
	app: App,
): Promise<FolderConflictStrategy> {
	return new Promise((resolve) => {
		new ChoiceModal<FolderConflictStrategy>(
			app,
			{
				heading: "Conflict strategy for folder push",
				message:
					"What should happen when a document with the same title already exists in Outline?",
				buttons: [
					{ label: "Overwrite all", value: "overwrite", cta: true },
					{ label: "Create duplicates", value: "duplicate" },
					{ label: "Cancel", value: "cancel" },
				],
				fallback: "cancel",
			},
			resolve,
		).open();
	});
}
