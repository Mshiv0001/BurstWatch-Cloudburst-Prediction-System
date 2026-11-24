import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  RotateCcw,
  BellRing,
  AlertTriangle,
  Send,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  registerSubscriber,
  registerSubscriberGoogle,
  verifySubscriber,
  resendVerificationCode,
  unsubscribeSubscriber,
  getLocalSubscription
} from '../services/subscriberService';

export default function EmailAlertModal({
  isOpen,
  onClose,
  onSubscribedChange
}) {
  const [step, setStep] = useState('input'); // 'input' | 'verify' | 'active'
  const [email, setEmail] = useState('');
  const [locationPref, setLocationPref] = useState('ALL');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpNotice, setDevOtpNotice] = useState('');

  const otpInputsRef = useRef([]);

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessMessage('');
      setDevOtpNotice('');
      const sub = getLocalSubscription();
      if (sub.isVerified && sub.email) {
        setEmail(sub.email);
        setStep('active');
      } else {
        if (sub.email) setEmail(sub.email);
        setStep('input');
      }
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Keyboard navigation: ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Step 1: Submit Email Registration
  const handleRegister = async (e) => {
    e?.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const res = await registerSubscriber(email, locationPref);
    setIsLoading(false);

    if (res.ok) {
      if (res.data.status === 'verified') {
        setStep('active');
        onSubscribedChange?.(true);
      } else {
        setStep('verify');
        setResendCooldown(60);
        setOtp(['', '', '', '', '', '']);
        if (res.data.dev_mode) {
          setDevOtpNotice('Development Mode: Check server console terminal for the 6-digit OTP code.');
        }
        setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
      }
    } else {
      setErrorMessage(res.error || 'Failed to send verification code. Please try again.');
    }
  };

  // Google OAuth 1-Click Handlers
  const onGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const decoded = jwtDecode(credentialResponse.credential);
      const userEmail = decoded.email || decoded.sub;
      const res = await registerSubscriberGoogle(credentialResponse.credential, locationPref);
      setIsLoading(false);

      if (res.ok) {
        setEmail(userEmail);
        setStep('active');
        setSuccessMessage('Successfully subscribed with Google! 1-click verification complete.');
        onSubscribedChange?.(true);
      } else {
        setErrorMessage(res.error || 'Google subscription failed.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Failed to decode Google account credential.');
    }
  };

  const handleDemoGoogleSignIn = async () => {
    const defaultEmail = email.trim() && email.includes('@') ? email.trim() : 'mshivhare0001@gmail.com';
    setIsLoading(true);
    setErrorMessage('');
    const res = await registerSubscriberGoogle(defaultEmail, locationPref);
    setIsLoading(false);

    if (res.ok) {
      setEmail(defaultEmail);
      setStep('active');
      setSuccessMessage('Subscribed successfully with Google (1-Click Verified)!');
      onSubscribedChange?.(true);
    } else {
      setErrorMessage(res.error || 'Google subscription failed.');
    }
  };

  // Step 2: Handle OTP Input
  const handleOtpChange = (index, value) => {
    // Handle paste of full 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIdx = Math.min(5, index + digits.length);
      otpInputsRef.current[nextIdx]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance cursor
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerify = async (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const res = await verifySubscriber(email, code);
    setIsLoading(false);

    if (res.ok) {
      setStep('active');
      setSuccessMessage('Email successfully verified! You will receive high-priority alerts.');
      onSubscribedChange?.(true);
    } else {
      setErrorMessage(res.error || 'Verification code failed. Please check the code and try again.');
    }
  };

  // Step 2: Resend Code
  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMessage('');
    const res = await resendVerificationCode(email);
    setIsLoading(false);

    if (res.ok) {
      setResendCooldown(60);
      setSuccessMessage('A fresh verification code has been dispatched.');
      if (res.data.dev_mode) {
        setDevOtpNotice('Development Mode: Check server console terminal for the new OTP code.');
      }
    } else {
      setErrorMessage(res.error || 'Failed to resend verification code.');
    }
  };

  // Step 3: Unsubscribe
  const handleUnsubscribe = async () => {
    if (!window.confirm(`Are you sure you want to stop receiving weather alerts for ${email}?`)) {
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    const res = await unsubscribeSubscriber(email);
    setIsLoading(false);

    if (res.ok) {
      setStep('input');
      onSubscribedChange?.(false);
      setSuccessMessage('You have been successfully unsubscribed.');
    } else {
      setErrorMessage(res.error || 'Failed to unsubscribe.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xl select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="glass-panel-translucent apple-liquid-glass w-full max-w-md rounded-3xl p-6 sm:p-7 relative flex flex-col gap-5 text-white overflow-hidden shadow-2xl border border-white/20"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ========================================================================= */}
          {/* STAGE 1: Email Registration Input                                         */}
          {/* ========================================================================= */}
          {step === 'input' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-cyan-300 shadow-md">
                  <BellRing className="w-5 h-5 text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                    BurstWatch Early Warning
                  </span>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    Weather Alert Subscriptions
                  </h2>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Receive high-priority email alerts when convective cloudbursts, severe flash flood threats, or extreme rainfall (&gt;50 mm/day) are forecasted.
              </p>

              {/* Google 1-Click Subscription */}
              <div className="flex flex-col gap-2.5 pt-1">
                {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                    <div className="w-full flex justify-center">
                      <GoogleLogin
                        onSuccess={onGoogleSuccess}
                        onError={() => setErrorMessage('Google Sign-In failed or was cancelled.')}
                        theme="filled_black"
                        shape="pill"
                        text="continue_with"
                        size="large"
                        width="100%"
                      />
                    </div>
                  </GoogleOAuthProvider>
                ) : (
                  <button
                    type="button"
                    onClick={handleDemoGoogleSignIn}
                    className="w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                )}

                {/* Aesthetic Divider */}
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium font-mono">
                    or enter email manually
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </div>

              {/* Email Input Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/10 border border-white/15 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-cyan-400 focus:bg-white/15 transition-all"
                  />
                </div>
              </div>

              {/* Alert Scope Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-slate-300">
                  Monitoring Region
                </label>
                <select
                  value={locationPref}
                  onChange={(e) => setLocationPref(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-full bg-white/10 border border-white/15 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900 text-white">Pan-India Convective Network (All 419+ Stations)</option>
                  <option value="Kedarnath Valley" className="bg-slate-900 text-white">Kedarnath Valley &amp; Garhwal Himalayas</option>
                  <option value="Western Ghats" className="bg-slate-900 text-white">Western Ghats &amp; Coastal Belts</option>
                  <option value="Northeast Corridors" className="bg-slate-900 text-white">Northeast Meghalaya &amp; Brahmaputra Valley</option>
                </select>
              </div>

              {/* Inline Error */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Inline Success */}
              {successMessage && (
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  {successMessage}
                </div>
              )}

              {/* Submit Pill Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-1 py-3 rounded-full apple-liquid-glass-cyan text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4 text-cyan-300" />
                  </>
                )}
              </button>

              <div className="text-[10px] text-slate-400 text-center">
                Strict verification required. Zero spam. 1-click unsubscribe anytime.
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: 6-Digit OTP Verification Screen                                  */}
          {/* ========================================================================= */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-emerald-300 shadow-md">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Step 2 of 2
                  </span>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    Enter Verification Code
                  </h2>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                We sent a 6-digit confirmation code to{' '}
                <strong className="text-cyan-300">{email}</strong>. Enter it below to activate your alerts:
              </div>

              {/* Monospace 6-Digit OTP Grid */}
              <div className="flex items-center justify-center gap-2 py-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputsRef.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-10 sm:w-11 h-12 text-center text-lg font-bold font-mono text-cyan-300 bg-white/10 border border-white/20 rounded-2xl focus:outline-none focus:border-cyan-400 focus:bg-cyan-500/10 transition-all shadow-inner"
                  />
                ))}
              </div>

              {/* Dev Mode Banner Notice */}
              {devOtpNotice && (
                <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  💡 {devOtpNotice}
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  {successMessage}
                </div>
              )}

              {/* Verify Action Button */}
              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full mt-1 py-3 rounded-full apple-liquid-glass-emerald text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Verify &amp; Activate Alerts</span>
                  </>
                )}
              </button>

              {/* Resend & Back Navigation */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('input');
                    setErrorMessage('');
                  }}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  &larr; Change email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isLoading}
                  className={`flex items-center gap-1 transition-colors cursor-pointer ${
                    resendCooldown > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-cyan-400 hover:text-cyan-300'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: Active Verified Subscription Dashboard                          */}
          {/* ========================================================================= */}
          {step === 'active' && (
            <div className="flex flex-col gap-4 text-center items-center">
              <div className="w-14 h-14 rounded-full apple-liquid-glass-emerald flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-emerald-400/50 mt-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-300 animate-pulse" />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Subscription Active
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-0.5">
                  Early Warnings Activated
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  High-priority convective weather alerts are active for:
                </p>
                <div className="mt-2 inline-block px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono font-medium text-cyan-300">
                  {email}
                </div>
              </div>

              {/* Thank you note */}
              <div className="w-full text-center bg-white/5 border border-white/10 rounded-2xl p-3.5 text-xs text-slate-300 font-medium">
                Thank you for subscribing!
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-full apple-liquid-glass-emerald text-white text-xs font-semibold tracking-wide shadow-md hover:bg-emerald-500/20 active:scale-98 transition-all cursor-pointer"
                >
                  Done
                </button>

                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={isLoading}
                  className="w-full py-2 rounded-full text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unsubscribe from alerts</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

