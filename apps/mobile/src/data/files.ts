import { Directory, File, Paths } from 'expo-file-system';

export function documentDir(folder: string): string {
  return `${Paths.document.uri}${folder}/`;
}

export async function copyFile(from: string, to: string): Promise<void> {
  new Directory(to.slice(0, to.lastIndexOf('/') + 1)).create({ intermediates: true, idempotent: true });
  await new File(from).copy(new File(to), { overwrite: true });
}

export function fileExists(uri: string): boolean {
  return new File(uri).exists;
}

export function deleteFile(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}

export function listFiles(dir: string): string[] {
  const directory = new Directory(dir);
  if (!directory.exists) return [];
  const names: string[] = [];
  for (const entry of directory.list()) if (entry instanceof File) names.push(entry.name);
  return names;
}

export function readBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

export function readableUri(uri: string): Promise<string> {
  return Promise.resolve(uri);
}

export function filesReady(): Promise<void> {
  return Promise.resolve();
}
