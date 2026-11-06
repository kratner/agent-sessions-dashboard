// Up to 0.7.3 the settings were named agentWorkspace.*; from 0.7.4 they are agentSessions.*.
// On first start the old values are copied to the new names, so nobody's settings are lost.
// The old entries stay in settings.json (VS Code can't write to settings no extension declares);
// VS Code shows them as unknown and they do nothing. Kept free of the vscode module so it can be
// unit tested.

export const OLD_SECTION = 'agentWorkspace';
export const NEW_SECTION = 'agentSessions';
export const SETTING_KEYS = ['appearance', 'endedWithinHours', 'showStatusBar', 'historyResultThreshold', 'checkForUpdates'] as const;

export type Scope = 'global' | 'workspace';
export interface ScopedValues {
  globalValue?: unknown;
  workspaceValue?: unknown;
}

/** The values to copy: each scope where the old setting is set and the new one isn't. */
export function settingsToCopy(oldValues: ScopedValues | undefined, newValues: ScopedValues | undefined): { scope: Scope; value: unknown }[] {
  const out: { scope: Scope; value: unknown }[] = [];
  if (oldValues?.globalValue !== undefined && newValues?.globalValue === undefined) out.push({ scope: 'global', value: oldValues.globalValue });
  if (oldValues?.workspaceValue !== undefined && newValues?.workspaceValue === undefined) out.push({ scope: 'workspace', value: oldValues.workspaceValue });
  return out;
}
