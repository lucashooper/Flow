export function readPluginSetting(key: string, defaultValue: boolean): boolean {
  const saved = localStorage.getItem(key);
  return saved !== null ? JSON.parse(saved) : defaultValue;
}

export function writePluginSetting(key: string, value: boolean): void {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('pluginSettingsChanged'));
}
