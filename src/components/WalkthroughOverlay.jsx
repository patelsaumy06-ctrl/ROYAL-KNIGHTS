import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, Sparkles, Play } from 'lucide-react';
import { G } from '../styles/theme';

const STEPS = [
  {
    title: "Welcome to Needlink AI",
    content: "This is your operational command center. Here you can see real-time statistics and strategic AI insights to manage community needs across the region.",
    target: "dashboard",
    position: "center"
  },
  {
    title: "Live High-Tech Maps",
    content: "Our custom geo-intelligence map visualizes crises with pulse animations and live telemetry feeds. Click any pin to see detailed mission data.",
    target: "map",
    position: "right"
  },
  {
    title: "Smart Volunteer Matching",
    content: "Our matching engine calculates distance, skill compatibility, and AI match scores to recommend the best responders for every urgent task.",
    target: "volunteers",
    position: "left"
  },
  {
    title: "AI Analysis Assistant",
    content: "Need deeper insights? Our built-in AI assistant analyzes live platform telemetry to answer your questions and provide strategic recommendations.",
    target: "ai-assistant",
    position: "bottom-right"
  }
];

export default function WalkthroughOverlay({ onComplete, onNav }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show walkthrough after a short delay
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      if (STEPS[next].target !== "ai-assistant") {
        onNav(STEPS[next].target);
      }
    } else {
      setVisible(false);
      onNav("landing");
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      if (STEPS[prev].target !== "ai-assistant") {
        onNav(STEPS[prev].target);
      }
    }
  };

  if (!visible) return null;

  const step = STEPS[currentStep];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          width: 400,
          background: '#fff',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 32px 64px rgba(0,0,0,0.2)',
          pointerEvents: 'all',
          border: '1px solid rgba(0,0,0,0.05)',
          position: 'relative'
        }}
      >
        <button
          onClick={() => setVisible(false)}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: G.t3, cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, background: G.blueLight, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color={G.blue} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.blue, textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Guide</div>
        </div>

        <h3 style={{ fontSize: 24, fontWeight: 700, color: G.t1, marginBottom: 12, letterSpacing: '-0.02em' }}>{step.title}</h3>
        <p style={{ fontSize: 15, color: G.t2, lineHeight: 1.6, marginBottom: 32 }}>{step.content}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === currentStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === currentStep ? G.blue : G.border,
                transition: 'all 0.3s'
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: `1px solid ${G.border}`, background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = G.bg}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <ChevronLeft size={20} color={G.t1} />
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                height: 44, padding: '0 24px', borderRadius: 12, border: 'none', background: G.blue, color: '#fff',
                display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 8px 16px rgba(37,99,235,0.2)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {currentStep === STEPS.length - 1 ? "Finish Tour" : "Next Step"} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
