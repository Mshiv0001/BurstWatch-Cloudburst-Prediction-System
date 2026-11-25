import React, { useState, useEffect } from 'react';
import { BellRing, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISSED_KEY = 'burstwatch_subscribe_popup_dismissed';

export default function SubscribeAlertPopup({
  isSubscribed = false,
  isModalOpen = false,
  onSubscribeClick,
  hasLeftDrawerOpen = false
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isSubscribed || isModalOpen) {
      setIsVisible(false);
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      if (localStorage.getItem(DISMISSED_KEY) === 'true') {
        return;
      }
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSubscribed, isModalOpen]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(DISMISSED_KEY, 'true');
    }
  };

  const handleSubscribe = () => {
    setIsVisible(false);
    if (onSubscribeClick) {
      onSubscribeClick();
    }
  };

  return (
    <AnimatePresence>
      {isVisible && !isSubscribed && !isModalOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-24 z-40 left-[62px] right-2.5 sm:right-auto sm:w-[340px] select-none pointer-events-auto transition-all duration-300 ${
            hasLeftDrawerOpen ? 'sm:left-20 lg:left-[428px]' : 'sm:left-20'
          }`}
          role="dialog"
          aria-label="Subscribe to Notification Service"
        >
          <div className="apple-liquid-glass rounded-3xl p-4 shadow-2xl text-slate-100 flex flex-col gap-3 relative border border-cyan-400/30">
            <button
              type="button"
              onClick={handleDismiss}
              className="apple-liquid-glass-pill absolute top-3 right-3 text-slate-300 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss subscription prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0 shadow-lg shadow-cyan-500/20">
                <BellRing className="w-4.5 h-4.5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  Subscribe to Alert Service
                </h4>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Get instant email &amp; cloudburst threshold alerts tailored to your region.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleSubscribe}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-full bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-100 border border-cyan-400/50 text-xs font-semibold shadow-md shadow-cyan-950/40 transition-all cursor-pointer active:scale-95"
              >
                <span>Subscribe Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="apple-liquid-glass-pill py-2 px-3.5 rounded-full text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

