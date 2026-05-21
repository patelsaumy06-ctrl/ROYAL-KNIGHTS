import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Brain, MapPin, Users, CheckCircle, Play, RotateCcw } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

const STEPS = [
  {
    id: 'report',
    icon: <FileText size={20} />,
    label: 'Field Report Received',
    color: '#8B5CF6',
    detail: '"Heavy flooding in Ahmedabad east district. 200+ families displaced. Need food, water, medical supplies urgently."',
    duration: 2500,
  },
  {
    id: 'analyze',
    icon: <Brain size={20} />,
    label: 'AI Analysis Complete',
    color: '#2563EB',
    detail: 'Category: Flood Relief · Priority: URGENT · Severity: 9/10 · Estimated affected: 200+ families',
    duration: 2000,
  },
  {
    id: 'map',
    icon: <MapPin size={20} />,
    label: 'Crisis Zone Mapped',
    color: '#F59E0B',
    detail: 'Geo-tagged to Ahmedabad East (23.0225° N, 72.5714° E). Added to live crisis map with urgency heatmap.',
    duration: 1800,
  },
  {
    id: 'match',
    icon: <Users size={20} />,
    label: 'Volunteers Matched',
    color: '#10B981',
    detail: '3 volunteers matched: Arjun K. (2.1 km, rescue), Priya M. (3.4 km, medical), Sonal R. (4.0 km, logistics)',
    duration: 2200,
  },
  {
    id: 'resolve',
    icon: <CheckCircle size={20} />,
    label: 'Response Deployed',
    color: '#14B8A6',
    detail: 'Volunteers dispatched. Average ETA: 12 minutes. Real-time tracking active. Crisis response initiated.',
    duration: 1500,
  },
];

export default function CrisisSimulator() {
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef(null);
  const { isMobile } = useMediaQuery();

  const start = () => {
    setRunning(true);
    setCurrentStep(0);
    setCompleted(false);
  };

  const reset = () => {
    clearTimeout(timerRef.current);
    setRunning(false);
    setCurrentStep(-1);
    setCompleted(false);
  };

  useEffect(() => {
    if (!running || currentStep < 0) return;
    if (currentStep >= STEPS.length) {
      setCompleted(true);
      setRunning(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, STEPS[currentStep].duration);
    return () => clearTimeout(timerRef.current);
  }, [running, currentStep]);

  const elapsed = currentStep >= 0
    ? STEPS.slice(0, Math.min(currentStep, STEPS.length)).reduce((s, step) => s + step.duration, 0) / 1000
    : 0;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        borderRadius: isMobile ? 20 : 28,
        padding: isMobile ? '28px 16px' : '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Decorative orb */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '40%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.15), transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 36 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 100,
              padding: '6px 16px',
              fontSize: 11,
              color: '#FCA5A5',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#EF4444',
                boxShadow: '0 0 8px #EF4444',
                animation: 'needlink-shimmer 1.5s ease infinite',
              }}
            />
            LIVE SIMULATION
          </div>
          <h3
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: isMobile ? 22 : 28,
              color: '#fff',
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            See NeedLink AI in Action
          </h3>
          <p
            style={{
              fontSize: isMobile ? 13 : 15,
              color: 'rgba(255,255,255,0.45)',
              maxWidth: 500,
              margin: '0 auto',
            }}
          >
            Watch how a real flood report gets processed — from field data to volunteer dispatch in
            under 60 seconds.
          </p>
        </div>

        {/* Timeline */}
        <div style={{ maxWidth: 600, margin: '0 auto', marginBottom: 28 }}>
          {STEPS.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            const isPending = i > currentStep;

            return (
              <AnimatePresence key={step.id}>
                <motion.div
                  initial={isDone || isActive ? { opacity: 0, x: -20 } : { opacity: 0.3 }}
                  animate={{
                    opacity: isPending && !completed ? 0.25 : 1,
                    x: 0,
                  }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: isMobile ? 12 : 16,
                    marginBottom: i < STEPS.length - 1 ? 8 : 0,
                    padding: isMobile ? '10px 8px' : '12px 16px',
                    borderRadius: 14,
                    background: isActive
                      ? `rgba(${step.color === '#2563EB' ? '37,99,235' : step.color === '#10B981' ? '16,185,129' : step.color === '#F59E0B' ? '245,158,11' : step.color === '#14B8A6' ? '20,184,166' : '139,92,246'},0.08)`
                      : 'transparent',
                    border: isActive
                      ? `1px solid rgba(255,255,255,0.08)`
                      : '1px solid transparent',
                    transition: 'all 0.3s',
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: isDone || isActive
                        ? step.color
                        : 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.2)',
                      flexShrink: 0,
                      transition: 'all 0.3s',
                      boxShadow: isActive ? `0 0 20px ${step.color}44` : 'none',
                    }}
                  >
                    {isDone ? <CheckCircle size={18} /> : step.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                        marginBottom: 4,
                        transition: 'color 0.3s',
                      }}
                    >
                      {step.label}
                      {isActive && (
                        <motion.span
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          style={{ color: step.color, marginLeft: 8, fontSize: 11 }}
                        >
                          Processing...
                        </motion.span>
                      )}
                      {isDone && (
                        <span style={{ color: '#10B981', marginLeft: 8, fontSize: 11 }}>
                          ✓ Complete
                        </span>
                      )}
                    </div>
                    {(isDone || isActive) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.5)',
                          lineHeight: 1.6,
                          fontStyle: i === 0 ? 'italic' : 'normal',
                        }}
                      >
                        {step.detail}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            );
          })}
        </div>

        {/* Footer / Controls */}
        <div style={{ textAlign: 'center' }}>
          {!running && !completed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={start}
              style={{
                background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
                color: '#fff',
                border: 'none',
                borderRadius: 100,
                padding: isMobile ? '14px 28px' : '16px 36px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 16px 40px -10px rgba(37,99,235,0.5)',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 20px 48px -10px rgba(37,99,235,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 16px 40px -10px rgba(37,99,235,0.5)';
              }}
            >
              <Play size={18} fill="#fff" /> Run Crisis Simulation
            </motion.button>
          )}

          {running && (
            <div
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#60A5FA', borderRadius: '50%' }}
              />
              Simulating response pipeline... {elapsed.toFixed(0)}s elapsed
            </div>
          )}

          {completed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#10B981',
                  marginBottom: 12,
                }}
              >
                ✅ Crisis response deployed in {(elapsed).toFixed(0)} seconds
              </div>
              <button
                onClick={reset}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 100,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                }}
              >
                <RotateCcw size={14} /> Run Again
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
