import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Sliders,
  LogOut,
  Trash2,
  X,
  ExternalLink,
  Send,
  Loader2,
  MapPin,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GoogleAuthButton from './GoogleAuthButton';
import AlertPreferencesCard from './AlertPreferencesCard';
import {
  getLocalSubscription,
  unsubscribeSubscriber,
  logoutSubscriber,
  updateSubscriberPreferences,
  checkSubscriberStatus
} from '../services/subscriberService';

export default function AlertsPanel({
  isOpen,
  onClose,
  onOpenModal,
  onSubscribedChange
}) {
  const [sub, setSub] = useState(() => getLocalSubscription());
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isEditingPrefs, setIsEditingPrefs] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [thresholdMm, setThresholdMm] = useState(50);

  // Sync state whenever panel opens
  useEffect(() => {
    if (isOpen) {
      const current = getLocalSubscription();
      setSub(current);
      setSelectedRegion(current.locationPref || 'ALL');
      setThresholdMm(current.minThresholdMm || 50);
      setMessage('');
      setIsEditingPrefs(false);
      if (current.isVerified && current.email) {
        checkSubscriberStatus(current.email).then((res) => {
          if (res?.status === 401) {
            setSub(getLocalSubscription());
            onSubscribedChange?.(false);
          }
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleAuthSuccess = () => {
    const updated = getLocalSubscription();
    setSub(updated);
    setIsError(false);
    setMessage('Authenticated with Google (Zero OTP Verified)!');
    onSubscribedChange?.(true);
  };

  const handleGoogleAuthError = (msg) => {
    setIsError(true);
    setMessage(msg || 'Google login failed.');
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    setMessage('');
    setIsError(false);
    const res = await updateSubscriberPreferences({
      locationPref: selectedRegion,
      minThresholdMm: thresholdMm
    });
    setIsLoading(false);
    if (res.ok) {
      setSub(getLocalSubscription());
      setIsEditingPrefs(false);
      setMessage('Alert preferences updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setIsError(true);
      setMessage(res.error || 'Failed to update preferences.');
    }
  };

  const handleUnsubscribe = async () => {
    if (!sub.email) return;
    if (!window.confirm(`Stop receiving severe convective weather alerts for ${sub.email}?`)) {
      return;
    }
    setIsLoading(true);
    const res = await unsubscribeSubscriber(sub.email);
    setIsLoading(false);
    if (res.ok) {
      setSub(getLocalSubscription());
      onSubscribedChange?.(false);
      setMessage('You have been unsubscribed.');
    } else {
      setIsError(true);
      setMessage(res.error || 'Failed to unsubscribe.');
    }
  };

  const handleSignOut = () => {
    logoutSubscriber();
    setSub(getLocalSubscription());
    onSubscribedChange?.(false);
    setMessage('Signed out successfully.');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="glass-panel-translucent apple-liquid-glass w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto scrollbar-none rounded-3xl p-5 sm:p-7 relative flex flex-col gap-5 text-white shadow-2xl border border-white/20"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="apple-liquid-glass-pill p-2.5 rounded-2xl text-cyan-300 shadow-md">
                <BellRing className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  BurstWatch Network
                </span>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Early Warning &amp; Alerts
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Inline Message */}
          {message && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                isError
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{message}</span>
            </div>
          )}

          {/* Authenticated State */}
          {sub.isVerified ? (
            <div className="flex flex-col gap-4">
              {/* User Identity Card */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {sub.picture ? (
                    <img
                      src={sub.picture}
                      alt={sub.name || 'User'}
                      className="w-12 h-12 rounded-full border-2 border-emerald-400 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full apple-liquid-glass-emerald flex items-center justify-center font-bold text-emerald-300 border border-emerald-400/40">
                      {sub.name ? sub.name[0].toUpperCase() : <ShieldCheck className="w-6 h-6" />}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {sub.name || 'BurstWatch Subscriber'}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {sub.authProvider === 'google' ? 'Google Verified' : 'Verified'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-300 font-mono">{sub.email}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of alerts"
                  className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Preferences Section */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-white">Alert Preferences</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPrefs((p) => !p)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer font-medium"
                  >
                    {isEditingPrefs ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {isEditingPrefs ? (
                  <div className="flex flex-col gap-3 pt-1">
                    <AlertPreferencesCard
                      compact
                      region={selectedRegion}
                      onRegionChange={setSelectedRegion}
                      thresholdMm={thresholdMm}
                      onThresholdChange={setThresholdMm}
                    />

                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      disabled={isLoading}
                      className="mt-1 py-2 px-4 rounded-full apple-liquid-glass-cyan text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Save Preferences</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Region</span>
                      <span className="font-medium text-white truncate block">{sub.locationPref || 'ALL'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Min Rain Trigger</span>
                      <span className="font-medium text-cyan-300">&gt;= {sub.minThresholdMm || 50} mm/day</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-full apple-liquid-glass-emerald text-white text-xs font-semibold cursor-pointer"
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
          ) : (
            /* Unauthenticated / Logged Out State */
            <div className="flex flex-col gap-3.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Select your concerned region and rainfall trigger below, then connect with Google or Email to receive instant convective alerts.
              </p>

              <AlertPreferencesCard
                compact
                region={selectedRegion}
                onRegionChange={setSelectedRegion}
                thresholdMm={thresholdMm}
                onThresholdChange={setThresholdMm}
              />

              {/* Google 1-Click Zero OTP Button */}
              <GoogleAuthButton
                locationPref={selectedRegion}
                minThresholdMm={thresholdMm}
                disabled={isLoading}
                onSuccess={handleGoogleAuthSuccess}
                onError={handleGoogleAuthError}
              />

              {/* Minimalist Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase font-mono text-slate-400">or continue with email</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Open Email Modal Button */}
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  onOpenModal?.();
                }}
                className="w-full py-2.5 px-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>Login with Email (OTP Code)</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
