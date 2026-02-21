import { Menu, Notice, Plugin, TFile, TFolder } from "obsidian";
import { OutlineClient } from "./outline-client";
import type { OutlineCollection } from "./outline-client";
import { PushEngine } from "./push-engine";
import { DEFAULT_SETTINGS, OutlineSyncSettingTab, OutlineSyncSettings } from "./settings";
import { pickCollection } from "./collection-picker-modal";

export default class OutlineSyncPlugin extends Plugin {
	settings: OutlineSyncSettings = DEFAULT_SETTINGS;
	client!: OutlineClient;
	cachedCollections: OutlineCollection[] = [];
	private engine!: PushEngine;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.rebuildClient();

		this.addSettingTab(new OutlineSyncSettingTab(this.app, this));

		if (this.settings.outlineUrl && this.settings.apiKey) {
			void this.refreshCollections();
		}

		this.addCommand({
			id: "push-to-outline",
			name: "Push aktive Datei zu Outline",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) {
					void this.pushFileWithPicker(file);
				}
				return true;
			},
		});

		this.addCommand({
			id: "push-folder-to-outline",
			name: "Push Ordner zu Outline",
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return;
				const folder = file.parent;
				if (folder instanceof TFolder) {
					void this.pushFolderWithPicker(folder);
				}
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, abstractFile) => {
				if (abstractFile instanceof TFile && abstractFile.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle("Push zu Outline")
							.setIcon("upload")
							.onClick(() => void this.pushFileWithPicker(abstractFile));
					});
				}

				if (abstractFile instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle("Ordner zu Outline pushen")
							.setIcon("folder-up")
							.onClick(() => void this.pushFolderWithPicker(abstractFile));
					});
				}
			})
		);
	}

	async pushFileWithPicker(file: TFile): Promise<void> {
		const collectionId = await this.resolveCollectionId();
		if (!collectionId) return;
		void this.engine.pushFile(file, collectionId);
	}

	async pushFolderWithPicker(folder: TFolder): Promise<void> {
		const collectionId = await this.resolveCollectionId();
		if (!collectionId) return;
		void this.engine.pushFolder(folder, collectionId);
	}

	private async resolveCollectionId(): Promise<string | null> {
		if (this.settings.targetCollectionId) {
			return this.settings.targetCollectionId;
		}

		if (this.cachedCollections.length === 0) {
			await this.refreshCollections();
		}

		if (this.cachedCollections.length === 0) {
			new Notice("Outline Sync: Keine Collections verfügbar. Bitte URL und API Key prüfen.");
			return null;
		}

		return pickCollection(this.app, this.cachedCollections, "");
	}

	async refreshCollections(): Promise<void> {
		const collections = await this.client.listCollections();
		this.cachedCollections = collections ?? [];
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.rebuildClient();
	}

	rebuildClient(): void {
		this.client = new OutlineClient(this.settings.outlineUrl, this.settings.apiKey);
		this.engine = new PushEngine(this.app, this.client, this.settings);
	}
}
