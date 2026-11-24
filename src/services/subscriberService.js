/**
 * subscriberService.js
 * 
 * Handles real-time communication with the BurstWatch subscriber backend API:
 * - Email registration & OTP dispatch
 * - 6-digit OTP verification
 * - Resend countdown & cooldown management
 * - Subscription status queries & localStorage sync
 * - 1-click unsubscriptions
 */

const LOCAL_STORAGE_KEY_EMAIL = 'burstwatch_subscriber_email';
const LOCAL_STORAGE_KEY_STATUS = 'burstwatch_subscriber_status';

function getCandidateBases() {
  if (import.meta.env.VITE_BACKEND_URL) {
    return [import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')];
  }
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      // 1. Vite proxy (/api -> http://localhost:8001)
      // 2. Direct port 8001
      // 3. Direct port 8000
      return ['/api', 'http://localhost:8001', 'http://localhost:8000'];
    }
  }
  return ['/api', 'https://burstwatch-ml-backend.onrender.com'];
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
export async function registerSubscriber(email, locationPref = 'ALL') {
  const normEmail = email.trim().toLowerCase();
  const res = await request('/subscribers/register', {
    method: 'POST',
    body: JSON.stringify({ email: normEmail, location_pref: locationPref }),
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
 * Register and verify a user via Google Sign-In (1-Click, skips OTP).
 */
export async function registerSubscriberGoogle(credential, locationPref = 'ALL') {
  const res = await request('/subscribers/google-auth', {
    method: 'POST',
    body: JSON.stringify({ credential, location_pref: locationPref }),
  });

  if (res.ok && res.data?.email) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, res.data.email);
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
    } catch (e) { }
  }
  return res;
}

/**
 * Verify the 6-digit OTP code to activate the subscription.
 */
export async function verifySubscriber(email, code) {
  const normEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();
  const res = await request('/subscribers/verify', {
    method: 'POST',
    body: JSON.stringify({ email: normEmail, code: cleanCode }),
  });

  if (res.ok) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAIL, normEmail);
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
    } catch (e) { }
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
 * Query current subscription & verification state for an email.
 */
export async function checkSubscriberStatus(email) {
  const normEmail = email.trim().toLowerCase();
  const res = await request(`/subscribers/status?email=${encodeURIComponent(normEmail)}`);
  if (res.ok && res.data) {
    try {
      if (res.data.verified) {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'verified');
      } else if (res.data.status === 'unsubscribed') {
        localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'unsubscribed');
      }
    } catch (e) { }
  }
  return res;
}

/**
 * Unsubscribe an email from receiving weather alerts.
 */
export async function unsubscribeSubscriber(emailOrToken) {
  const isEmail = emailOrToken.includes('@');
  const payload = isEmail ? { email: emailOrToken.trim().toLowerCase() } : { token: emailOrToken.trim() };
  const res = await request('/subscribers/unsubscribe', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_STATUS, 'unsubscribed');
    } catch (e) { }
  }
  return res;
}

/**
 * Read current cached subscription from localStorage.
 */
export function getLocalSubscription() {
  if (typeof window === 'undefined') {
    return { email: '', status: 'none', isVerified: false };
  }
  try {
    const email = localStorage.getItem(LOCAL_STORAGE_KEY_EMAIL) || '';
    const status = localStorage.getItem(LOCAL_STORAGE_KEY_STATUS) || 'none';
    return {
      email,
      status,
      isVerified: status === 'verified',
    };
  } catch (e) {
    return { email: '', status: 'none', isVerified: false };
  }
}

