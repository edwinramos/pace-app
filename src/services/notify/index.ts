/**
 * Notificaciones LOCALES con expo-notifications. En Expo Go (Android) las
 * push remotas no están disponibles desde SDK 53, pero las locales sí; si algo
 * falla, se ignora y la app muestra el aviso dentro de la pantalla igualmente.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let ready: boolean | null = null;

async function ensure(): Promise<boolean> {
  if (ready != null) return ready;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('equipo', {
        name: 'Equipo',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const cur = await Notifications.getPermissionsAsync();
    const st = cur.granted ? cur : await Notifications.requestPermissionsAsync();
    ready = !!st.granted;
  } catch {
    ready = false;
  }
  return ready;
}

/** Devuelve true si la notificación se programó. */
export async function notifyNow(title: string, body: string): Promise<boolean> {
  try {
    if (!(await ensure())) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: 'equipo' } as any : null,
    });
    return true;
  } catch {
    return false;
  }
}
