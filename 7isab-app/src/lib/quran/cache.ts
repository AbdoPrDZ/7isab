/**
 * Offline copy of the Quran on the device, one JSON file per page,
 * under documents/quran/<version>/. A new server version starts a new folder.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { QuranMeta, QuranPage } from './types';

const ROOT = 'quran';
const META_FILE = 'meta.json';

/** Web has no document directory: keep a memory-only cache there. */
const memory = new Map<string, string>();
const useMemory = Platform.OS === 'web';

function directory(version: string): Directory {
  const dir = new Directory(Paths.document, ROOT, version);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function readJson<T>(version: string, name: string): Promise<T | null> {
  try {
    if (useMemory) {
      const value = memory.get(`${version}/${name}`);
      return value ? (JSON.parse(value) as T) : null;
    }
    const file = new File(directory(version), name);
    return file.exists ? (JSON.parse(await file.text()) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(version: string, name: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  try {
    if (useMemory) {
      memory.set(`${version}/${name}`, text);
      return;
    }
    const file = new File(directory(version), name);
    if (!file.exists) file.create();
    await file.write(text);
  } catch {
    // A failed cache write only means the page is fetched again next time.
  }
}

/** The last metadata seen, from any version (used to open the app offline). */
const LATEST_FILE = 'latest-meta.json';

export async function readLatestMeta(): Promise<QuranMeta | null> {
  return readJson<QuranMeta>('_', LATEST_FILE);
}

export async function writeMeta(meta: QuranMeta): Promise<void> {
  await Promise.all([writeJson(meta.version, META_FILE, meta), writeJson('_', LATEST_FILE, meta)]);
}

export function readPage(version: string, page: number): Promise<QuranPage | null> {
  return readJson<QuranPage>(version, `page-${page}.json`);
}

export function writePage(version: string, page: QuranPage): Promise<void> {
  return writeJson(version, `page-${page.number}.json`, page);
}
