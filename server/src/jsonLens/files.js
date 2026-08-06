import fs from 'node:fs/promises';
import path from 'node:path';

// Arbitrary on-disk JSON files the user has opened via the folder tree —
// read/write only, no tailing/polling (unlike Log Lens's tabs, JSON Lens
// never needs to watch a file for external changes; it's a one-shot editor).

export async function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  const content = await fs.readFile(resolved, 'utf8');
  return { path: resolved, content };
}

export async function writeJsonFile(filePath, content) {
  const resolved = path.resolve(filePath);
  await fs.writeFile(resolved, content, 'utf8');
  return { path: resolved };
}

export async function fileExists(filePath) {
  try {
    await fs.access(path.resolve(filePath));
    return true;
  } catch {
    return false;
  }
}

export async function deleteJsonFile(filePath) {
  await fs.unlink(path.resolve(filePath));
}

export async function renameJsonFile(fromPath, toPath) {
  const from = path.resolve(fromPath);
  const to = path.resolve(toPath);
  await fs.rename(from, to);
  return { path: to };
}
