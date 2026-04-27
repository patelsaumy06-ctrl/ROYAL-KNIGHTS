import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  AlertTriangle,
  Terminal,
  Zap,
  Users,
  Eye,
  Loader2,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] },
  }),
};

const DK = {
  shell: '#0c0c0e',
  bg: '#121212',
  card: '#161616',
  cardElevated: '#1c1c1c',
  surface: '#222222',
  border: '#2e2e2e',
  borderStrong: '#3d3d3d',
  text: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  accent: '#ff5722',
  accentSoft: 'rgba(255, 87, 34, 0.14)',
  accentGlow: 'rgba(255, 87, 34, 0.38)',
  accentDim: '#e64a19',
  green: '#10B981',
  blue: '#3B82F6',
  violet: '#8B5CF6',
  terminal: '#0a0a0a',
  terminalBorder: '#1e1e1e',
};

export default function EmergencyAIInsights({
  onNav,
  onEmergencyActivated,
  onNeedsRefresh,
}) {
  const [copiedBtn, setCopiedBtn] = useState(null);
  const [emergencyHover, setEmergencyHover] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState('idle');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchError, setDispatchError] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBtn(id);
      setTimeout(() => setCopiedBtn(null), 2000);
    });
  };

  const activateEmergency = useCallback(async () => {
    if (dispatchStatus === 'loading') return;
    setDispatchError(null);
    setDispatchStatus('loading');
    try {
      const res = await api.activateEmergencyMode();
      if (!res.success) {
        setDispatchError(res.error || 'Could not activate emergency mode.');
        setDispatchStatus('error');
        return;
      }
      setDispatchResult(res);
      setDispatchStatus('success');
      onNeedsRefresh?.();
      onEmergencyActivated?.();
    } catch (e) {
      console.error(e);
      setDispatchError(e?.message || 'Something went wrong.');
      setDispatchStatus('error');
    }
  }, [dispatchStatus, onEmergencyActivated, onNeedsRefresh]);

  const resetDispatch = useCallback(() => {
    setDispatchStatus('idle');
    setDispatchResult(null);
    setDispatchError(null);
  }, []);

  const emergencyBullets = [
    { icon: <Zap size={15} strokeWidth={2.25} />, text: 'Auto-prioritize tasks' },
    { icon: <Users size={15} strokeWidth={2.25} />, text: 'Notify nearest volunteers' },
    { icon: <Eye size={15} strokeWidth={2.25} />, text: 'Highlight critical zones' },
  ];

  const aiSummaryText = 'Today: 23 tasks completed, 5 pending in high-risk zones.';
  const isSuccess = dispatchStatus === 'success' && dispatchResult;
  const distLabel =
    dispatchResult?.distanceKm != null
      ? `${dispatchResult.distanceKm.toFixed(1)} km away`
      : 'proximity match';

  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${DK.shell} 0%, ${DK.bg} 45%, #141416 100%)`,
        padding: 28,
        borderRadius: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        fontFamily: "'Inter', system-ui, sans-serif",
        border: `1px solid ${DK.borderStrong}`,
        boxShadow: `
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 24px 48px rgba(0,0,0,0.45),
          0 0 80px rgba(255, 87, 34, 0.06)
        `,
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: `linear-gradient(135deg, ${DK.accentSoft}, rgba(139,92,246,0.12))`,
            border: `1px solid rgba(255, 87, 34, 0.28)`,
            borderRadius: 999,
            padding: '7px 16px',
            fontSize: 11,
            color: DK.accent,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: `0 0 24px ${DK.accentGlow}`,
          }}
        >
          <AlertTriangle size={14} strokeWidth={2.5} />
          Emergency & AI Insights
        </div>
      </motion.div>

      <motion.div
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        style={{
          background: `linear-gradient(180deg, ${DK.cardElevated} 0%, ${DK.card} 100%)`,
          borderRadius: 20,
          border: `1px solid ${emergencyHover ? 'rgba(255,87,34,0.45)' : DK.border}`,
          overflow: 'hidden',
          transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
          boxShadow: emergencyHover
            ? `0 0 0 1px rgba(255,87,34,0.12), 0 20px 40px rgba(0,0,0,0.5), 0 0 64px rgba(255,87,34,0.12)`
            : '0 12px 32px rgba(0,0,0,0.35)',
        }}
        onMouseEnter={() => setEmergencyHover(true)}
        onMouseLeave={() => setEmergencyHover(false)}
      >
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${DK.accent}, #ff784e, ${DK.accentDim}, ${DK.accent})`,
            backgroundSize: '200% 100%',
            animation: emergencyHover ? 'emergencyBarShift 2.4s linear infinite' : 'none',
          }}
        />

        <div style={{ padding: '22px 24px 20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: DK.accentSoft,
                  border: '1px solid rgba(255,87,34,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={20} color={DK.accent} strokeWidth={2.25} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: DK.text,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Emergency mode
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: DK.textMuted, fontWeight: 500 }}>
                  One action: urgent task, nearest volunteer, instant alert
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleCopy('Activate Emergency Mode — Needlink', 'emergency-title')}
              style={{
                background: DK.surface,
                border: `1px solid ${DK.border}`,
                borderRadius: 10,
                padding: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                color: copiedBtn === 'emergency-title' ? DK.green : DK.textMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = DK.accent;
                e.currentTarget.style.color = DK.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = DK.border;
                e.currentTarget.style.color = copiedBtn === 'emergency-title' ? DK.green : DK.textMuted;
              }}
              title="Copy"
            >
              {copiedBtn === 'emergency-title' ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          <motion.button
            type="button"
            whileHover={dispatchStatus === 'loading' || isSuccess ? {} : { scale: 1.01 }}
            whileTap={dispatchStatus === 'loading' || isSuccess ? {} : { scale: 0.985 }}
            onClick={activateEmergency}
            disabled={dispatchStatus === 'loading' || isSuccess}
            style={{
              width: '100%',
              padding: '15px 22px',
              borderRadius: 14,
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Inter', system-ui, sans-serif",
              cursor: dispatchStatus === 'loading' || isSuccess ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: '#fff',
              background:
                isSuccess
                  ? 'linear-gradient(135deg, #059669, #10B981)'
                  : `linear-gradient(135deg, ${DK.accent}, ${DK.accentDim})`,
              boxShadow: isSuccess
                ? '0 8px 28px rgba(16,185,129,0.35)'
                : `0 8px 28px ${DK.accentGlow}, 0 0 0 1px rgba(255,255,255,0.08) inset`,
              transition: 'background 0.35s ease, box-shadow 0.35s ease, opacity 0.2s',
              letterSpacing: '-0.01em',
              opacity: dispatchStatus === 'loading' ? 0.92 : 1,
            }}
          >
            {dispatchStatus === 'loading' && (
              <Loader2 size={20} style={{ animation: 'nlSpin 0.8s linear infinite' }} />
            )}
            {dispatchStatus === 'loading' && 'Dispatching…'}
            {dispatchStatus !== 'loading' && isSuccess && 'Emergency dispatched'}
            {dispatchStatus !== 'loading' && !isSuccess && '🚨 Activate Emergency Mode'}
          </motion.button>

          {dispatchError && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                color: '#fca5a5',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {dispatchError}
            </div>
          )}

          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                marginTop: 14,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.22)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: DK.green,
                    flexShrink: 0,
                  }}
                >
                  <Bell size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: DK.text, marginBottom: 4 }}>
                    {dispatchResult.volunteer.name} notified and assigned
                  </div>
                  <div style={{ fontSize: 12.5, color: DK.textSecondary, lineHeight: 1.55 }}>
                    Urgent task <strong style={{ color: DK.text }}>{dispatchResult.need.location}</strong>
                    {' · '}
                    <span style={{ color: DK.textMuted }}>{distLabel}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onNav?.('tasks')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: DK.green,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View tasks <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={resetDispatch}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${DK.border}`,
                    background: 'transparent',
                    color: DK.textSecondary,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dispatch again
                </button>
              </div>
            </motion.div>
          )}

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emergencyBullets.map((item, idx) => (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.28 + idx * 0.07 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: DK.surface,
                  border: `1px solid ${DK.border}`,
                  borderLeft: `3px solid ${DK.accent}`,
                  transition: 'border-color 0.2s ease, background 0.2s ease',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'rgba(255,87,34,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: DK.accent,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <span style={{ fontSize: 13.5, color: DK.textSecondary, fontWeight: 500 }}>{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        style={{
          background: DK.card,
          borderRadius: 18,
          border: `1px solid ${DK.border}`,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)';
          e.currentTarget.style.boxShadow = `0 0 28px rgba(139,92,246,0.15), 0 12px 32px rgba(0,0,0,0.35)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = DK.border;
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, ${DK.violet}, #a855f7)` }} />
        <div style={{ padding: '22px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Terminal size={18} color={DK.violet} />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: DK.text,
                letterSpacing: '-0.02em',
              }}
            >
              AI summary
            </h3>
          </div>
          <div
            style={{
              background: DK.terminal,
              border: `1px solid ${DK.terminalBorder}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: `1px solid ${DK.terminalBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                <span
                  style={{
                    fontSize: 11,
                    color: DK.textMuted,
                    marginLeft: 8,
                    fontWeight: 500,
                    fontFamily: "'SF Mono', ui-monospace, monospace",
                  }}
                >
                  ai-summary.sh
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(aiSummaryText, 'ai-summary')}
                style={{
                  background: 'transparent',
                  border: `1px solid ${DK.terminalBorder}`,
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 500,
                  color: copiedBtn === 'ai-summary' ? DK.green : DK.textMuted,
                  transition: 'all 0.2s ease',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = DK.violet;
                  e.currentTarget.style.color = DK.violet;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = DK.terminalBorder;
                  e.currentTarget.style.color = copiedBtn === 'ai-summary' ? DK.green : DK.textMuted;
                }}
                title="Copy"
              >
                {copiedBtn === 'ai-summary' ? <Check size={13} /> : <Copy size={13} />}
                {copiedBtn === 'ai-summary' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div
                style={{
                  fontFamily: "'SF Mono', ui-monospace, monospace",
                  fontSize: 13,
                  lineHeight: 1.75,
                  color: DK.green,
                }}
              >
                <span style={{ color: DK.violet, userSelect: 'none' }}>❯ </span>
                <span style={{ color: DK.textSecondary }}>echo </span>
                <span style={{ color: DK.green }}>&quot;{aiSummaryText}&quot;</span>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0, 1] }}
                transition={{ duration: 1.4, delay: 0.7, repeat: Infinity, repeatDelay: 3 }}
                style={{
                  marginTop: 6,
                  fontFamily: "'SF Mono', ui-monospace, monospace",
                  fontSize: 13,
                  color: DK.textMuted,
                }}
              >
                <span style={{ color: DK.violet, userSelect: 'none' }}>❯ </span>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 16,
                    background: DK.violet,
                    borderRadius: 1,
                    verticalAlign: 'text-bottom',
                  }}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes emergencyBarShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes nlSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
