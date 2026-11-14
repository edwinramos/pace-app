/** Exportar una carrera a GPX o JSON y abrir el menú de compartir de Android. */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareText(fileName: string, content: string, mimeType: string): Promise<void> {
  const f = new File(Paths.cache, fileName);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible en este dispositivo.');
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: 'Exportar carrera' });
}

export function safeFileName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 60);
}
