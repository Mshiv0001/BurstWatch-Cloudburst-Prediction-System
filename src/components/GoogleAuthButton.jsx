import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { registerSubscriberGoogle } from '../services/subscriberService';

const GOOGLE_G_ICON = (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z" />
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
  </svg>
);

function GoogleOAuthTriggerButton({ disabled, isAuthenticating, onCredential, onError }) {
  const login = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: (tokenResponse) => {
      if (!tokenResponse?.access_token) {
        onError?.('Google did not return an access token.');
        return;
      }
      onCredential(tokenResponse.access_token);
    },
    onError: (err) => {
      onError?.(err?.error_description || 'Google Sign-In popup was closed or blocked.');
    },
  });

  return (
    <button
      type="button"
      onClick={() => login()}
      disabled={disabled || isAuthenticating}
      className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-100 border border-white/20 text-slate-900 text-xs font-bold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
    >
      {GOOGLE_G_ICON}
      <span>{isAuthenticating ? 'Signing in with Google...' : 'Continue with Google'}</span>
    </button>
  );
}

/**
 * Unified Google OAuth 2.0 Sign-In button.
 * Uses useGoogleLogin() to open the real Google Account Chooser popup when
 * VITE_GOOGLE_CLIENT_ID is configured; falls back to an explicitly labeled
 * dev-only demo button when unconfigured.
 */
export default function GoogleAuthButton({
  locationPref = 'ALL',
  minThresholdMm = 50,
  fallbackEmail = '',
  disabled = false,
  onSuccess,
  onError,
}) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

  const handleCredential = async (credential) => {
    try {
      setIsAuthenticating(true);
      const res = await registerSubscriberGoogle(credential, locationPref, minThresholdMm);
      if (res.ok) {
        onSuccess?.(res);
      } else {
        onError?.(res.error || 'Google authentication failed.');
      }
    } catch {
      onError?.('Failed to authenticate with Google.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (hasGoogleClientId) {
    return (
      <GoogleOAuthTriggerButton
        disabled={disabled}
        isAuthenticating={isAuthenticating}
        onCredential={handleCredential}
        onError={onError}
      />
    );
  }

  const demoEmail =
    fallbackEmail?.trim() && fallbackEmail.includes('@')
      ? fallbackEmail.trim()
      : 'demo@burstwatch.live';

  return (
    <button
      type="button"
      onClick={() => handleCredential(demoEmail)}
      disabled={disabled || isAuthenticating}
      className="w-full py-2.5 px-4 rounded-full bg-white hover:bg-slate-100 border border-white/20 text-slate-900 text-xs font-bold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
    >
      {GOOGLE_G_ICON}
      <span>Continue with Google (Demo — set VITE_GOOGLE_CLIENT_ID)</span>
    </button>
  );
}
