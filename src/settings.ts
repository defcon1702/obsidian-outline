import { App, DropdownComponent, Notice, PluginSettingTab, Setting } from "obsidian";
import type OutlineSyncPlugin from "./main";
import type { OutlineCollection } from "./outline-client";

export interface OutlineSyncSettings {
	outlineUrl: string;
	apiKey: string;
	targetCollectionId: string;
	targetCollectionName: string;
}

export const DEFAULT_SETTINGS: OutlineSyncSettings = {
	outlineUrl: "",
	apiKey: "",
	targetCollectionId: "",
	targetCollectionName: "",
};

export class OutlineSyncSettingTab extends PluginSettingTab {
	plugin: OutlineSyncPlugin;
	private collectionDropdown: DropdownComponent | null = null;

	constructor(app: App, plugin: OutlineSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		if (this.plugin.cachedCollections.length > 0) {
			void this.loadCollections();
		}

		const warning = containerEl.createEl("div", { cls: "callout" });
		warning.style.cssText = "background:var(--background-modifier-error-hover);border-left:3px solid var(--color-orange);padding:8px 12px;margin-bottom:16px;border-radius:4px;font-size:0.85em;";
		warning.createEl("strong", { text: "Security notice: " });
		warning.appendText("The API key is stored in plain text in data.json. Make sure this file is excluded from public cloud sync services (e.g. iCloud, Dropbox).");

		new Setting(containerEl)
			.setName("Outline URL")
			.setDesc("URL of your Outline instance, e.g. https://outline.example.com")
			.addText((text) =>
				text
					.setPlaceholder("https://outline.example.com")
					.setValue(this.plugin.settings.outlineUrl)
					.onChange(async (value) => {
						this.plugin.settings.outlineUrl = value.trim().replace(/\/$/, "");
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("API Key")
			.setDesc("Outline API Key (Settings → API & Apps)")
			.addText((text) => {
				text
					.setPlaceholder("ol_api_...")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Validate API Key")
			.setDesc("Test connection to Outline and load collections")
			.addButton((btn) =>
				btn
					.setButtonText("Connect")
					.setCta()
					.onClick(async () => {
						btn.setButtonText("Checking…");
						btn.setDisabled(true);
						const ok = await this.plugin.client.validateAuth();
						btn.setDisabled(false);
						if (ok) {
							btn.setButtonText("✓ Connected");
							await this.loadCollections();
						} else {
							btn.setButtonText("✗ Failed");
							new Notice("Connection failed. Check URL and API key.");
						}
					})
			);

		new Setting(containerEl)
			.setName("Default Collection")
			.setDesc("Documents will be pushed to this collection by default")
			.addDropdown((dropdown) => {
				this.collectionDropdown = dropdown;
				dropdown.addOption("", "— Connect first —");
				if (this.plugin.settings.targetCollectionId) {
					dropdown.addOption(
						this.plugin.settings.targetCollectionId,
						this.plugin.settings.targetCollectionName
					);
					dropdown.setValue(this.plugin.settings.targetCollectionId);
				}
				dropdown.onChange(async (value) => {
					this.plugin.settings.targetCollectionId = value;
					await this.plugin.saveSettings();
				});
			});
	}

	async loadCollections(): Promise<void> {
		await this.plugin.refreshCollections();
		const collections = this.plugin.cachedCollections;

		if (collections.length === 0 || !this.collectionDropdown) {
			new Notice("Could not load collections.");
			return;
		}

		const dropdown = this.collectionDropdown;
		const selectEl = dropdown.selectEl;
		selectEl.empty();

		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.text = "— Select collection —";
		selectEl.appendChild(placeholder);

		for (const col of collections) {
			const opt = document.createElement("option");
			opt.value = col.id;
			opt.text = col.name;
			if (col.id === this.plugin.settings.targetCollectionId) {
				opt.selected = true;
			}
			selectEl.appendChild(opt);
		}

		dropdown.onChange(async (value) => {
			const selected = collections.find((c: OutlineCollection) => c.id === value);
			this.plugin.settings.targetCollectionId = value;
			this.plugin.settings.targetCollectionName = selected?.name ?? "";
			await this.plugin.saveSettings();
		});

		new Notice(`${collections.length} collection(s) loaded.`);
	}
}
