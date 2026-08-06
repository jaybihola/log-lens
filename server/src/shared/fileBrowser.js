import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// `extFilter` (e.g. ".json") narrows the *files* shown, without ever hiding
// directories — you still need to see folders to navigate into them even if
// nothing directly inside the current one matches yet. Undefined/omitted
// keeps every prior caller's behavior identical (no filtering at all).
export async function browseDirectory(requestedDir, showHidden, extFilter) {
  const dir = path.resolve(requestedDir || os.homedir());
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const entries = dirents
    .filter((d) => d.isDirectory() || d.isFile())
    .filter((d) => showHidden || !d.name.startsWith('.'))
    .filter((d) => !extFilter || d.isDirectory() || d.name.toLowerCase().endsWith(extFilter))
    .map((d) => ({ name: d.name, isDir: d.isDirectory() }))
    .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  const parent = path.dirname(dir);
  return { dir, parent: parent === dir ? null : parent, entries };
}
