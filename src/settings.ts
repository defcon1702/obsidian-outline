export interface OutlineSyncSettings {
  outlineUrl: string;
  apiKey: string;
  targetCollectionId: string;
  targetCollectionName: string;
  removeToc: boolean;
}

export const DEFAULT_SETTINGS: OutlineSyncSettings = {
  outlineUrl: '',
  apiKey: '',
  targetCollectionId: '',
  targetCollectionName: '',
  removeToc: false,
};
