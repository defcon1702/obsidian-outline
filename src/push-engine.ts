import { App, Notice, TFile, TFolder } from 'obsidian';
import { OutlineClient } from './outline-client';
import { OutlineSyncSettings } from './settings';
import { syncDocument, syncFolder } from './sync';
import type { SyncOptions } from './sync';
import { createObsidianSyncEnv, buildWikiLinkResolver } from './adapters/obsidian';
import { resolveConflict, resolveFolderConflictStrategy } from './plugin-ui/conflict-modal';
import { SyncLogNotice } from './plugin-ui/sync-log-notice';
import { getErrorMessage } from './utils/errors';

export class PushEngine {
  private app: App;
  private client: OutlineClient;
  private settings: OutlineSyncSettings;

  constructor(app: App, client: OutlineClient, settings: OutlineSyncSettings) {
    this.app = app;
    this.client = client;
    this.settings = settings;
  }

  private buildOptions(
    collectionId: string,
    folderConflictStrategy: 'overwrite' | 'duplicate'
  ): SyncOptions {
    return {
      outlineUrl: this.settings.outlineUrl,
      apiKey: this.settings.apiKey,
      collectionId,
      removeToc: this.settings.removeToc,
      indexAsFolder: true,
      folderConflictStrategy,
    };
  }

  async pushFile(file: TFile, collectionId?: string): Promise<void> {
    if (!this.validateConfig()) return;

    const targetCollection = collectionId ?? this.settings.targetCollectionId;
    const notice = new Notice(`Pushing "${file.basename}" to Outline…`, 0);

    try {
      const options = this.buildOptions(targetCollection, 'overwrite');
      const env = createObsidianSyncEnv({
        app: this.app,
        api: this.client,
        getWikiResolverForSingleFile: () => buildWikiLinkResolver(this.app),
        resolveConflict: (title) => resolveConflict(this.app, title),
        onProgress: (msg) => {
          notice.setMessage(msg);
        },
      });

      const fd = { path: file.path, basename: file.basename, _file: file };
      const result = await syncDocument(options, env, fd);

      notice.hide();
      if (result) {
        new Notice(`✓ "${file.basename}" pushed to Outline`, 5000);
      }
    } catch (e) {
      notice.hide();
      new Notice(`✗ Push failed: ${getErrorMessage(e)}`, 8000);
      console.error('[Outline Sync] pushFile error:', e);
    }
  }

  async pushFolder(folder: TFolder, collectionId?: string): Promise<void> {
    if (!this.validateConfig()) return;

    const targetCollection = collectionId ?? this.settings.targetCollectionId;
    const folderStrategy = await resolveFolderConflictStrategy(this.app);
    if (folderStrategy === 'cancel') return;

    const log = new SyncLogNotice(`Pushing ${folder.name}…`);

    const options = this.buildOptions(targetCollection, folderStrategy);
    const env = createObsidianSyncEnv({
      app: this.app,
      api: this.client,
      onProgress: (msg) => log.appendLine(msg),
    });

    try {
      const result = await syncFolder(options, env, folder.path);
      const ok = result.failed === 0;
      const summary = ok
        ? `✓ ${result.success} file(s) successfully pushed`
        : `✓ ${result.success} pushed, ✗ ${result.failed} failed`;
      log.finish(summary, ok);
    } catch (e) {
      log.finish(`✗ Push failed: ${getErrorMessage(e)}`, false);
      console.error('[Outline Sync] pushFolder error:', e);
    }
  }

  private validateConfig(): boolean {
    if (!this.settings.outlineUrl || !this.settings.apiKey) {
      new Notice('Outline Sync: Please configure URL and API key in settings.');
      return false;
    }
    return true;
  }
}
