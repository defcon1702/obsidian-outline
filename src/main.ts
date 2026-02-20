import { Menu, Plugin, TFile, TFolder } from "obsidian";
import { OutlineClient } from "./outline-client";
import { PushEngine } from "./push-engine";
import { DEFAULT_SETTINGS, OutlineSyncSettingTab, OutlineSyncSettings } from "./settings";

export default class OutlineSyncPlugin extends Plugin {
	settings: OutlineSyncSettings = DEFAULT_SETTINGS;
	client!: OutlineClient;
	private engine!: PushEngine;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.rebuildClient();

		this.addSettingTab(new OutlineSyncSettingTab(this.app, this));

		this.addCommand({
			id: "push-to-outline",
			name: "Push aktive Datei zu Outline",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) {
					void this.engine.pushFile(file);
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
					void this.engine.pushFolder(folder);
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
							.onClick(() => void this.engine.pushFile(abstractFile));
					});
				}

				if (abstractFile instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle("Ordner zu Outline pushen")
							.setIcon("folder-up")
							.onClick(() => void this.engine.pushFolder(abstractFile));
					});
				}
			})
		);
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
