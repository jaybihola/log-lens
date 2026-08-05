import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function browseDirectory(requestedDir, showHidden) {
  const dir = path.resolve(requestedDir || os.homedir());
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const entries = dirents
    .filter((d) => d.isDirectory() || d.isFile())
    .filter((d) => showHidden || !d.name.startsWith('.'))
    .map((d) => ({ name: d.name, isDir: d.isDirectory() }))
    .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
  const parent = path.dirname(dir);
  return { dir, parent: parent === dir ? null : parent, entries };
}
