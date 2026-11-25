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
  Sliders,
  Trash2,
  LogOut,
  MapPin,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleAuthButton from './GoogleAuthButton';
import AlertPreferencesCard from './AlertPreferencesCard';
import {
  registerSubscriber,
  verifySubscriber,
  resendVerificationCode,
  unsubscribeSubscriber,
  updateSubscriberPreferences,
  logoutSubscriber,
  getLocalSubscription,
  checkSubscriberStatus
} from '../services/subscriberService';

export default function EmailAlertModal({
  isOpen,
  onClose,
  onSubscribedChange
}) {
  const [step, setStep] = useState('input'); // 'input' | 'verify' | 'active'
  const [email, setEmail] = useState('');
  const [locationPref, setLocationPref] = useState('ALL');
  const [minThresholdMm, setMinThresholdMm] = useState(50);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [userProfile, setUserProfile] = useState(() => getLocalSubscription());
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const otpInputsRef = useRef([]);

  // Sync state on modal open
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessMessage('');
      setDevOtpNotice('');
      const sub = getLocalSubscription();
      setUserProfile(sub);
      if (sub.isVerified && sub.email) {
        setEmail(sub.email);
        setLocationPref(sub.locationPref || 'ALL');
        setMinThresholdMm(sub.minThresholdMm || 50);
        setStep('active');
        // Validate session token asynchronously against server
        checkSubscriberStatus(sub.email).then((res) => {
          if (res?.status === 401) {
            const fresh = getLocalSubscription();
            setUserProfile(fresh);
            setStep('input');
            onSubscribedChange?.(false);
          }
        });
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
    const res = await registerSubscriber(email, locationPref, minThresholdMm);
    setIsLoading(false);

    if (res.ok) {
      setStep('verify');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      if (res.data?.dev_mode) {
        setDevOtpNotice('Development Mode: Check server console terminal for the 6-digit OTP code.');
      }
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
    } else {
      setErrorMessage(res.error || 'Failed to send verification code. Please try again.');
    }
  };

  // Google OAuth 1-Click Handlers (ZERO OTP)
  const handleGoogleAuthSuccess = () => {
    const current = getLocalSubscription();
    setUserProfile(current);
    setEmail(current.email);
    setErrorMessage('');
    setStep('active');
    setSuccessMessage('Successfully subscribed with Google! Zero-OTP authentication verified.');
    onSubscribedChange?.(true);
  };

  const handleGoogleAuthError = (msg) => {
    setErrorMessage(msg || 'Google Sign-In failed.');
  };

  // Step 2: Handle OTP Input
  const handleOtpChange = (index, value) => {
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
      const current = getLocalSubscription();
      setUserProfile(current);
      setStep('active');
      setSuccessMessage('Email successfully verified! Convective early warnings activated.');
      onSubscribedChange?.(true);
    } else {
      setErrorMessage(res.error || 'Verification failed. Please check the code and try again.');
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

  // Step 3: Save Preferences
  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    setErrorMessage('');
    setSuccessMessage('');
    const res = await updateSubscriberPreferences({
      locationPref,
      minThresholdMm
    });
    setIsSavingPrefs(false);

    if (res.ok) {
      setUserProfile(getLocalSubscription());
      setSuccessMessage('Notification preferences saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(res.error || 'Failed to update preferences.');
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
      setUserProfile(getLocalSubscription());
      setStep('input');
      onSubscribedChange?.(false);
      setSuccessMessage('You have been successfully unsubscribed.');
    } else {
      setErrorMessage(res.error || 'Failed to unsubscribe.');
    }
  };

  // Step 3: Sign Out
  const handleSignOut = () => {
    logoutSubscriber();
    setUserProfile(getLocalSubscription());
    setStep('input');
    onSubscribedChange?.(false);
    setSuccessMessage('Signed out successfully.');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xl select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="glass-panel-translucent apple-liquid-glass w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-none rounded-3xl p-5 sm:p-7 relative flex flex-col gap-5 text-white shadow-2xl border border-white/20"
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
          {/* STAGE 1: Dual-Path Login & Registration Screen                            */}
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

              {/* Alert Region & Rainfall Threshold */}
              <AlertPreferencesCard
                compact
                region={locationPref}
                onRegionChange={setLocationPref}
                thresholdMm={minThresholdMm}
                onThresholdChange={setMinThresholdMm}
              />

              {/* Path A: Google 1-Click Login (Zero OTP) */}
              <div className="flex flex-col gap-2.5 pt-1">
                <GoogleAuthButton
                  locationPref={locationPref}
                  minThresholdMm={minThresholdMm}
                  fallbackEmail={email}
                  disabled={isLoading}
                  onSuccess={handleGoogleAuthSuccess}
                  onError={handleGoogleAuthError}
                />

                {/* Aesthetic Minimal Divider */}
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium font-mono">
                    or continue with email
                  </span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </div>

              {/* Path B: Email Address Input Field */}
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

              {/* Submit Button */}
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
          {/* STAGE 3: Active Verified Subscription & Preferences Dashboard            */}
          {/* ========================================================================= */}
          {step === 'active' && (
            <div className="flex flex-col gap-4">
              {/* Profile Card */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                {userProfile.picture ? (
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name || 'User Avatar'}
                    className="w-12 h-12 rounded-full border-2 border-emerald-400 shadow-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full apple-liquid-glass-emerald flex items-center justify-center font-bold text-emerald-300 border border-emerald-400/40 shrink-0">
                    {userProfile.name ? userProfile.name[0].toUpperCase() : <ShieldCheck className="w-6 h-6" />}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white truncate">
                      {userProfile.name || 'BurstWatch Subscriber'}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      {userProfile.authProvider === 'google' ? 'Google Verified' : 'Email Verified'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-mono truncate block mt-0.5">
                    {email}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of alerts"
                  className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Preferences Configuration */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-white">Alert Preferences</span>
                </div>

                {/* Region selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Monitoring Region</label>
                  <select
                    value={locationPref}
                    onChange={(e) => setLocationPref(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="ALL">Pan-India Convective Network (All Stations)</option>
                    <option value="Kedarnath Valley">Kedarnath Valley &amp; Garhwal Himalayas</option>
                    <option value="Western Ghats">Western Ghats &amp; Coastal Belts</option>
                    <option value="Northeast Corridors">Northeast Meghalaya &amp; Brahmaputra Valley</option>
                  </select>
                </div>

                {/* Rainfall threshold slider */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span className="uppercase font-semibold">Rainfall Alert Threshold</span>
                    <span className="text-cyan-300 font-bold">&gt;= {minThresholdMm} mm/day</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="5"
                    value={minThresholdMm}
                    onChange={(e) => setMinThresholdMm(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>25 mm (Moderate)</span>
                    <span>50 mm (Heavy)</span>
                    <span>100 mm (Extreme)</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={isSavingPrefs}
                  className="mt-1 py-2 rounded-xl apple-liquid-glass-cyan text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPrefs ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                  )}
                  <span>Save Notification Preferences</span>
                </button>
              </div>

              {/* Inline Success or Error */}
              {successMessage && (
                <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
              {errorMessage && (
                <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-full apple-liquid-glass-emerald text-white text-xs font-semibold cursor-pointer shadow-md"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-full text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unsubscribe</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
