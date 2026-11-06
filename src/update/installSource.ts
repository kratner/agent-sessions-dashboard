import * as fs from 'fs';
import * as path from 'path';

// Where this copy was installed from, as VS Code records it in extensions.json in the extensions
// folder: "gallery" for the Marketplace, "vsix" for a .vsix file. Marketplace installs are kept up
// to date by VS Code, so the daily GitHub check skips them. No `vscode` imports, so it can be tested
// from plain Node.

export type InstallSource = 'gallery' | 'vsix' | 'unknown';

interface Entry {
  identifier?: { id?: string };
  relativeLocation?: string;
  location?: string | { path?: string; fsPath?: string };
  metadata?: { source?: string };
}

function locationPath(e: Entry): string {
  if (typeof e.location === 'string') return e.location;
  return e.location?.path ?? e.location?.fsPath ?? '';
}

/** The install source of extension `id` in folder `folder`, from the parsed extensions.json. */
export function sourceFromExtensionsJson(json: unknown, id: string, folder: string): InstallSource {
  if (!Array.isArray(json)) return 'unknown';
  const want = id.toLowerCase();
  const matches = (json as Entry[]).filter((e) => e?.identifier?.id?.toLowerCase() === want);
  const entry =
    matches.find((e) => e.relativeLocation === folder || locationPath(e).replace(/\\/g, '/').endsWith(`/${folder}`)) ??
    (matches.length === 1 ? matches[0] : undefined);
  const source = entry?.metadata?.source;
  return source === 'gallery' || source === 'vsix' ? source : 'unknown';
}

/** The install source of the extension at `extensionPath`; "unknown" if it can't be read. */
export function installSource(extensionPath: string, id: string): InstallSource {
  try {
    const file = path.join(path.dirname(extensionPath), 'extensions.json');
    return sourceFromExtensionsJson(JSON.parse(fs.readFileSync(file, 'utf8')), id, path.basename(extensionPath));
  } catch {
    return 'unknown';
  }
}
