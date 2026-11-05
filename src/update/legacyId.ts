// Versions up to 0.6.2 were published as kratner.agent-workspace-dashboard. From 0.7.0 the
// extension is fourounces.agent-workspace-dashboard, on the VS Code Marketplace. VS Code treats
// the two IDs as different extensions, so the old copy has to be removed once. Kept free of the
// vscode module so it can be unit tested.

export const MARKETPLACE_ID = 'fourounces.agent-workspace-dashboard';
export const LEGACY_IDS = ['kratner.agent-workspace-dashboard'];

/** The old copies to uninstall, given this copy's ID and a lookup of installed extensions. */
export function legacyCopies(ownId: string, isInstalled: (id: string) => boolean): string[] {
  const own = ownId.toLowerCase();
  return LEGACY_IDS.filter((id) => id !== own && isInstalled(id));
}
