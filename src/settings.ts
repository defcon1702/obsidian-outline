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

		new Setting(containerEl)
			.setName("Outline URL")
			.setDesc("URL deiner Outline-Instanz, z.B. https://outline.example.com")
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
			.setName("API Key validieren")
			.setDesc("Verbindung zu Outline testen und Collections laden")
			.addButton((btn) =>
				btn
					.setButtonText("Verbinden")
					.setCta()
					.onClick(async () => {
						btn.setButtonText("Prüfe...");
						btn.setDisabled(true);
						const ok = await this.plugin.client.validateAuth();
						btn.setDisabled(false);
						if (ok) {
							btn.setButtonText("✓ Verbunden");
							await this.loadCollections();
						} else {
							btn.setButtonText("✗ Fehler");
							new Notice("Verbindung fehlgeschlagen. URL und API Key prüfen.");
						}
					})
			);

		new Setting(containerEl)
			.setName("Ziel-Collection")
			.setDesc("Alle gepushten Dokumente landen in dieser Collection")
			.addDropdown((dropdown) => {
				this.collectionDropdown = dropdown;
				dropdown.addOption("", "— Erst verbinden —");
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
			new Notice("Collections konnten nicht geladen werden.");
			return;
		}

		const dropdown = this.collectionDropdown;
		const selectEl = dropdown.selectEl;
		selectEl.empty();

		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.text = "— Collection wählen —";
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

		new Notice(`${collections.length} Collections geladen.`);
	}
}
