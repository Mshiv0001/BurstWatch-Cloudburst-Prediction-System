/**
 * subscriberService.js
 * 
 * Industry-Grade Authentication & Alert Subscription Service:
 * - Google Sign-In (Zero-OTP, 1-Click Verification)
 * - Passwordless Email OTP Verification with Rate Limiting & Cooldown
 * - Cryptographic Session JWT Cache (burstwatch_auth_token)
 * - User Profile Persistence (burstwatch_user_profile)
 * - Notification Preferences (Monitoring Valley & Rain Threshold)
 * - RFC 8058 One-Click Unsubscribe
 */

export const LOCAL_STORAGE_KEY_EMAIL = 'burstwatch_subscriber_email';
export const LOCAL_STORAGE_KEY_STATUS = 'burstwatch_subscriber_status';
export const LOCAL_STORAGE_KEY_TOKEN = 'burstwatch_auth_token';
export const LOCAL_STORAGE_KEY_PROFILE = 'burstwatch_user_profile';

function getCandidateBases() {
  if (import.meta.env.VITE_BACKEND_URL) {
    return [import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')];
  }
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      // 1. Vite proxy (/api -> http://localhost:8001 or 8000)
      // 2. Direct port 8000
      // 3. Direct port 8001
      return ['/api', 'http://localhost:8000', 'http://localhost:8001'];
    }
  }
  return ['/api', 'https://burstwatch-ml-backend.onrender.com'];
}

function getAuthHeader() {
  if (typeof window === 'undefined') return {};
  try {
    const token = localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch (e) {}
  return {};
}

async function request(endpoint, options = {}) {
  const bases = getCandidateBases();
  let lastError = 'Network error connecting to alert service';

  for (const base of bases) {
    const url = `${base}${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
          ...options.headers,
        },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data.detail || data.message || `Request failed with status ${res.status}`;
        return { ok: false, error: errorMsg, status: res.status };
      }
      return { ok: true, data };
    } catch (err) {
      lastError = err.message || lastError;
      // Try next candidate base
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Register a user's email to initiate 6-digit OTP verification.
 */
export async function registerSubscriber(email, locationPref = 'ALL', minThresholdMm = 50) {
  const normEmail = email.trim().toLowerCase();
  const res = await request('/subscribers/register', {
    method: 'POST',
    body: JSON.stringify({
      email: normEmail,
      location_pref: locationPref,
      min_threshold_mm: Number(minThresholdMm) || 50,
    }),
  });

  if (res.ok) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, normEmail);
      if (res.data.status === 'verified') {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
      } else {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'pending');
      }
    } catch (e) {
      // Ignore localStorage write failures in private browsing
    }
  }
  return res;
}

/**
 * Register and verify a user via Google Sign-In (1-Click, Zero OTP).
 * Cryptographically verifies token on backend, stores signed session JWT and profile.
 */
export async function registerSubscriberGoogle(credential, locationPref = 'ALL', minThresholdMm = 50) {
  const res = await request('/subscribers/google-auth', {
    method: 'POST',
    body: JSON.stringify({
      credential,
      location_pref: locationPref,
      min_threshold_mm: Number(minThresholdMm) || 50,
    }),
  });

  if (res.ok && res.data) {
    const { email, access_token, name, picture, auth_provider, min_threshold_mm } = res.data;
    try {
      if (email) localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, email);
      if (access_token) localStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, access_token);
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
      const profile = {
        email: email || '',
        name: name || '',
        picture: picture || '',
        authProvider: auth_provider || 'google',
        locationPref: locationPref || res.data.location_pref || 'ALL',
        minThresholdMm: min_threshold_mm || 50.0,
        verified: true,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {}
  }
  return res;
}

/**
 * Verify the 6-digit OTP code to activate subscription with brute-force protection.
 */
export async function verifySubscriber(email, code) {
  const normEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();
  const res = await request('/subscribers/verify', {
    method: 'POST',
    body: JSON.stringify({ email: normEmail, code: cleanCode }),
  });

  if (res.ok && res.data) {
    const { access_token, name, picture, auth_provider, location_pref, min_threshold_mm } = res.data;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, normEmail);
      if (access_token) localStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, access_token);
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
      const profile = {
        email: normEmail,
        name: name || '',
        picture: picture || '',
        authProvider: auth_provider || 'email',
        locationPref: location_pref || 'ALL',
        minThresholdMm: min_threshold_mm || 50.0,
        verified: true,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {}
  }
  return res;
}

/**
 * Resend a refreshed 6-digit verification code.
 */
export async function resendVerificationCode(email) {
  const normEmail = email.trim().toLowerCase();
  return await request('/subscribers/resend', {
    method: 'POST',
    body: JSON.stringify({ email: normEmail }),
  });
}

/**
 * Update notification preferences (valley and rain threshold) with Bearer token.
 */
export async function updateSubscriberPreferences({ locationPref, minThresholdMm }) {
  const sub = getLocalSubscription();
  const payload = {
    location_pref: locationPref,
    min_threshold_mm: minThresholdMm != null ? Number(minThresholdMm) : undefined,
  };
  if (sub.email) {
    payload.email = sub.email;
  }
  const res = await request('/subscribers/preferences', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    try {
      const currentProfile = getLocalSubscription();
      const updatedProfile = {
        ...currentProfile,
        locationPref: locationPref || currentProfile.locationPref,
        minThresholdMm: minThresholdMm != null ? Number(minThresholdMm) : currentProfile.minThresholdMm,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(updatedProfile));
    } catch (e) {}
  }
  return res;
}

/**
 * Query current subscription & verification state for an email, validating session token.
 */
export async function checkSubscriberStatus(email) {
  const normEmail = (email || '').trim().toLowerCase();
  // 1. If we have a session token, query /subscribers/me first
  const token = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) : null;
  if (token) {
    const meRes = await request('/subscribers/me');
    if (meRes.ok && meRes.data) {
      try {
        const d = meRes.data;
        if (d.verified) {
          localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
          localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, d.email);
          const profile = {
            email: d.email,
            name: d.name || '',
            picture: d.picture || '',
            authProvider: d.auth_provider || 'email',
            locationPref: d.location_pref || 'ALL',
            minThresholdMm: d.min_threshold_mm || 50.0,
            verified: true,
          };
          localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify(profile));
        }
      } catch (e) {}
      return meRes;
    } else if (meRes.status === 401) {
      // Session token is expired, invalid, or server secret changed: clean up session
      logoutSubscriber();
      return { ok: false, error: 'Session expired. Please sign in again.', status: 401 };
    }
  }

  // 2. Fallback to status endpoint
  if (!normEmail) return { ok: false, error: 'No active session or email provided' };
  const res = await request(`/subscribers/status?email=${encodeURIComponent(normEmail)}`);
  if (res.ok && res.data) {
    try {
      if (res.data.verified) {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
      } else if (res.data.status === 'unsubscribed') {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'unsubscribed');
      }
    } catch (e) {}
  }
  return res;
}

/**
 * Unsubscribe an email or token from receiving weather alerts.
 */
export async function unsubscribeSubscriber(emailOrToken) {
  const raw = typeof emailOrToken === 'string' ? emailOrToken.trim() : '';
  const isEmail = raw.includes('@');
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN));

  if (isEmail && !hasToken) {
    return { ok: false, error: 'Active session or unsubscribe token required.', status: 401 };
  }

  const payload = isEmail ? { email: raw.toLowerCase() } : { token: raw };
  const res = await request('/subscribers/unsubscribe', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'unsubscribed');
      localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
      const profile = getLocalSubscription();
      localStorage.setItem(LOCAL_STORAGE_KEY_PROFILE, JSON.stringify({ ...profile, token: '', verified: false, status: 'unsubscribed' }));
    } catch (e) {}
  }
  return res;
}

/**
 * Clear all cached subscriber credentials from localStorage.
 */
export function logoutSubscriber() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_KEY_PROFILE);
    localStorage.removeItem(LOCAL_STORAGE_KEY_EMAIL);
    localStorage.removeItem(LOCAL_STORAGE_KEY_STATUS);
  } catch (e) {}
}

/**
 * Read current cached subscription and profile from localStorage.
 */
export function getLocalSubscription() {
  if (typeof window === 'undefined') {
    return {
      email: '',
      name: '',
      picture: '',
      authProvider: 'email',
      status: 'none',
      isVerified: false,
      token: '',
      locationPref: 'ALL',
      minThresholdMm: 50.0,
    };
  }
  try {
    const email = localStorage.getItem(LOCAL_STORAGE_KEY_EMAIL) || '';
    const status = localStorage.getItem(LOCAL_STORAGE_KEY_STATUS) || 'none';
    const token = localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN) || '';
    let profile = {};
    const rawProfile = localStorage.getItem(LOCAL_STORAGE_KEY_PROFILE);
    if (rawProfile) {
      try {
        profile = JSON.parse(rawProfile);
      } catch (e) {}
    }

    return {
      email: profile.email || email,
      name: profile.name || '',
      picture: profile.picture || '',
      authProvider: profile.authProvider || (profile.picture ? 'google' : 'email'),
      status,
      isVerified: status === 'verified' || profile.verified === true,
      token,
      locationPref: profile.locationPref || 'ALL',
      minThresholdMm: profile.minThresholdMm || 50.0,
    };
  } catch (e) {
    return {
      email: '',
      name: '',
      picture: '',
      authProvider: 'email',
      status: 'none',
      isVerified: false,
      token: '',
      locationPref: 'ALL',
      minThresholdMm: 50.0,
    };
  }
}
