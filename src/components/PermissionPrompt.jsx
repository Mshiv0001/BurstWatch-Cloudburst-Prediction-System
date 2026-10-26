import React, { useState, useEffect } from 'react';
import { Bell, MapPin, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getNotificationPermission, 
  requestPermissionsAndNotify,
  sendBrowserNotification 
} from '../utils/notifications';

export default function PermissionPrompt({ onLocationAcquired }) {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'requesting' | 'granted'

  useEffect(() => {
    // Check if notification permission is not decided yet
    const perm = getNotificationPermission();
    if (perm === 'default') {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermissions = async () => {
    setStatus('requesting');
    await requestPermissionsAndNotify({
      onLocationSuccess: (coords) => {
        if (onLocationAcquired) onLocationAcquired(coords);
      }
    });

    setStatus('granted');
    setTimeout(() => {
      setIsVisible(false);
    }, 2500);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="fixed top-16 right-4 sm:right-8 z-50 max-w-sm w-full select-none"
      >
        <div className="apple-liquid-glass rounded-3xl p-5 shadow-2xl text-slate-100 flex flex-col gap-3.5 relative">
          <button
            onClick={() => setIsVisible(false)}
            className="apple-liquid-glass-pill absolute top-3.5 right-3.5 text-slate-300 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-500/25">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                Enable Emergency Alerts
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Allow browser location and notification permissions to receive immediate cloudburst warnings for your sector.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <button
              onClick={handleRequestPermissions}
              disabled={status === 'requesting'}
              className="apple-liquid-glass-pill flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              {status === 'granted' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Permissions Active!</span>
                </>
              ) : status === 'requesting' ? (
                <span>Requesting Permissions...</span>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Allow Location &amp; Alerts</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="apple-liquid-glass-pill py-2.5 px-4 rounded-full text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
