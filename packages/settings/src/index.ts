// The public entry point of @kete/settings. Anything not exported here is internal.

export {
  createAccountSettings,
  type AccountLayers,
  type AccountSettings,
  type AccountSettingsOptions,
} from './account.js';
export {
  defineSettings,
  LAYERS,
  setting,
  SettingError,
  type Layer,
  type SettableLayer,
  type SettingDeclaration,
  type SettingDescription,
  type SettingsRegistry,
  type Words,
} from './declare.js';
export { keteSettings } from './kete.js';
export { resolve, type LayerValues, type Resolved } from './resolve.js';
export {
  APP_SCOPE,
  clearSetting,
  readLayers,
  setSetting,
  settingHistory,
  settingsHere,
  settingsMigrationSql,
  type SettingsMigrationOptions,
  type StoredLayer,
} from './store.js';
