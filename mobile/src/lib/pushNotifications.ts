import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { savePushToken } from '@/lib/api';

// Best-effort: a user who denies the permission, or a Simulator (which has no real APNs
// connection), should never block sign-in or surface an error - low-stock pushes are a nice-to-have.
export async function registerForPushNotifications(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let status = existingStatus;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await savePushToken(pushToken);
  } catch {
    // Ignore - see comment above.
  }
}
