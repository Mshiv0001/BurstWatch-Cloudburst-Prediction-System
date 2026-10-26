// Browser Geolocation and Native Notification Utility

export const isNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const isGeolocationSupported = () => {
  return typeof window !== 'undefined' && 'geolocation' in navigator;
};

export const getNotificationPermission = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

/**
 * Send a native browser notification if granted
 */
export const sendBrowserNotification = (title, options = {}) => {
  if (!isNotificationSupported()) return null;

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        icon: '/vite.svg',
        badge: '/vite.svg',
        silent: false,
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (err) {
      console.warn('Failed to dispatch browser notification:', err);
    }
  }
  return null;
};

/**
 * Request both Geolocation and Notification permissions from the browser
 */
export const requestPermissionsAndNotify = async ({
  onLocationSuccess,
  onLocationError
} = {}) => {
  let notifPermission = 'unsupported';
  let userCoords = null;

  // 1. Request Browser Native Notification Permission
  if (isNotificationSupported()) {
    try {
      notifPermission = await Notification.requestPermission();
    } catch (err) {
      console.warn('Notification permission request error:', err);
    }
  }

  // 2. Request Browser Native Geolocation Permission
  if (isGeolocationSupported()) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        if (onLocationSuccess) onLocationSuccess(userCoords);

        // Send confirmation notification once location is acquired
        if (notifPermission === 'granted') {
          sendBrowserNotification("📍 Real-Time Location Connected", {
            body: `Latitude: ${userCoords.lat.toFixed(3)}°, Longitude: ${userCoords.lng.toFixed(3)}°. Localized Cloudburst tracking is now active.`,
            tag: "location-connected"
          });
        }
      },
      (error) => {
        console.warn('Geolocation error or denied:', error);
        if (onLocationError) onLocationError(error);

        // Still send active alert notification if notification permission was granted
        if (notifPermission === 'granted') {
          sendBrowserNotification("⚡ Cloudburst Early Warning Active", {
            body: "Convective alert tracking active. (Default catchment stations in Western Himalayas).",
            tag: "alert-active"
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  } else if (notifPermission === 'granted') {
    sendBrowserNotification("⚡ Cloudburst Early Warning Active", {
      body: "Convective alert monitoring is active.",
      tag: "alert-active"
    });
  }

  return {
    notificationPermission: notifPermission,
    coords: userCoords
  };
};
