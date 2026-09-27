import { readPluginSetting } from './pluginSettings';

export const EDITOR_CONTENT_WIDTH_STANDARD = 800;
export const EDITOR_CONTENT_WIDTH_WIDE = 1200;
/** Default horizontal gap between side-by-side images (Notion-style). */
export const IMAGE_ROW_GAP = 24;
/** Default display width for a single unscaled image. */
export const DEFAULT_IMAGE_WIDTH = 420;

export function isWideCanvasEnabled(): boolean {
  return readPluginSetting('wideCanvasEnabled', false);
}

export function getEditorContentMaxWidth(): number {
  return isWideCanvasEnabled()
    ? EDITOR_CONTENT_WIDTH_WIDE
    : EDITOR_CONTENT_WIDTH_STANDARD;
}
