import { copyFile, deleteFile, documentDir, fileExists, listFiles, readableUri } from '../data/files';

export interface PendingFiles {
  uriFor(path: string): Promise<string>;
  copy(from: string, path: string): Promise<string>;
  exists(path: string): boolean;
  remove(path: string): void;
  list(): string[];
}

const FOLDER = 'pending';

function pendingDir(): string {
  return documentDir(FOLDER);
}

function target(path: string): string {
  return `${pendingDir()}${pendingName(path)}`;
}

const SEP = '~';

export function pendingName(path: string): string {
  return path.split('/').join(SEP);
}

export function pathFromPendingName(name: string): string | null {
  const path = name.split(SEP).join('/');
  return path.includes('/') ? path : null;
}

export const pendingFiles: PendingFiles = {
  uriFor(path) {
    return readableUri(target(path));
  },
  async copy(from, path) {
    await copyFile(from, target(path));
    return pendingFiles.uriFor(path);
  },
  exists(path) {
    return fileExists(target(path));
  },
  remove(path) {
    removeFile(target(path));
  },
  list() {
    const paths: string[] = [];
    for (const name of listFiles(pendingDir())) {
      const path = pathFromPendingName(name);
      if (path) paths.push(path);
    }
    return paths;
  },
};

export function removePendingFor(userId: string, files: Pick<PendingFiles, 'list' | 'remove'> = pendingFiles): void {
  for (const path of files.list()) if (path.startsWith(`${userId}/`)) files.remove(path);
}

export function removeFile(uri: string): void {
  try {
    deleteFile(uri);
  } catch {}
}
