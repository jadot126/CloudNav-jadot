/**
 * Extension Builder Service
 *
 * Generates browser extension files from templates with configuration injection.
 * Templates are stored in src/templates/extension/ with placeholders:
 * - {{API_BASE}} - The API domain URL
 * - {{PASSWORD}} - The admin password
 * - {{NAV_TITLE}} - The navigation title for the extension name
 */

import manifestTemplate from '../templates/extension/manifest.template.json?raw';
import backgroundTemplate from '../templates/extension/background.template.js?raw';
import sidebarHtmlTemplate from '../templates/extension/sidebar.template.html?raw';
import sidebarJsTemplate from '../templates/extension/sidebar.template.js?raw';

export interface ExtensionConfig {
  apiBase: string;
  password: string;
  navTitle: string;
  browserType: 'chrome' | 'firefox';
}

export interface ExtensionFiles {
  'manifest.json': string;
  'background.js': string;
  'sidebar.html': string;
  'sidebar.js': string;
}

/**
 * Replace template placeholders with actual values
 */
const replaceTemplateVars = (template: string, config: ExtensionConfig): string => {
  return template
    .replace(/\{\{API_BASE\}\}/g, config.apiBase)
    .replace(/\{\{PASSWORD\}\}/g, config.password)
    .replace(/\{\{NAV_TITLE\}\}/g, config.navTitle || 'CloudNav');
};

/**
 * Process manifest.json with browser-specific settings
 */
const processManifest = (config: ExtensionConfig): string => {
  const manifest = JSON.parse(replaceTemplateVars(manifestTemplate, config));

  // Add Firefox-specific settings
  if (config.browserType === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: "cloudnav@example.com",
        strict_min_version: "109.0"
      }
    };
  }

  return JSON.stringify(manifest, null, 2);
};

/**
 * Generate all extension files with the given configuration
 */
export const generateExtensionFiles = (config: ExtensionConfig): ExtensionFiles => {
  return {
    'manifest.json': processManifest(config),
    'background.js': replaceTemplateVars(backgroundTemplate, config),
    'sidebar.html': sidebarHtmlTemplate, // No variables to replace
    'sidebar.js': replaceTemplateVars(sidebarJsTemplate, config),
  };
};

/**
 * Get individual template content (for display in UI)
 */
export const getTemplateContent = (
  templateName: keyof ExtensionFiles,
  config: ExtensionConfig
): string => {
  const files = generateExtensionFiles(config);
  return files[templateName];
};

/**
 * Get raw template content without variable replacement (for reference)
 */
export const getRawTemplates = () => ({
  manifest: manifestTemplate,
  background: backgroundTemplate,
  sidebarHtml: sidebarHtmlTemplate,
  sidebarJs: sidebarJsTemplate,
});
