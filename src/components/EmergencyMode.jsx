import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, AlertTriangle, Users, MapPin, Clock, Activity,
  ChevronDown, ChevronUp, Radio, Loader2, Siren, Volume2,
  CheckCircle2, XCircle, RefreshCw, Terminal,
} from 'lucide-react';
import { activateFullEmergencyMode } from '../services/emergencyService';
import { G } from '../styles/theme';

const DK = {
  bg: '#0c0c0e', card: '#161616', surface: '#1c1c1c',
  border: '#2a2a2a', text: '#f4f4f5', muted: '#71717a',
  secondary: '#a1a1aa', red: '#EF4444', orange: '#F97316',
  amber: '#F59E0B', green: '#10B981',
};

export default function EmergencyMode({
  emergency, setEmergency, evaluateEmergency, onDeactivateEmergency,
  onNav, isMobile = false,
}) {
  const [phase, setPhase] = useState('idle'); // idle | loading | active
  const [panelOpen, setPanelOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [syncCountdown, setSyncCountdown] = useState(10);
  const [logsOpen, setLogsOpen] = useState(false);
  const synthRef = useRef(null);

  // Sync with external emergency state
  useEffect(() => {
    if (emergency && phase === 'idle') {
      setPhase('active');
      setPanelOpen(true);
    } else if (!emergency && phase === 'active') {
      setPhase('idle');
      setPanelOpen(false);
      setResult(null);
      setLogs([]);
    }
  }, [emergency, phase]);

  // Countdown timer for auto-sync
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      setSyncCountdown((prev) => {
        if (prev <= 1) {
          evaluateEmergency?.();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, evaluateEmergency]);

  // Voice alert
  const speakAlert = useCallback((text) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1; u.pitch = 0.9; u.volume = 0.8;
        window.speechSynthesis.speak(u);
        synthRef.current = u;
      }
    } catch { /* silent */ }
  }, []);

  // Activate handler
  const handleActivate = useCallback(async () => {
    if (phase === 'loading' || phase === 'active') return;
    setPhase('loading');
    setError(null);
    setLogs([{ time: new Date().toISOString(), action: 'INIT', detail: 'Analyzing situation…' }]);

    // Mobile vibration
    try { navigator?.vibrate?.([100, 50, 200]); } catch { /* */ }

    try {
      const res = await activateFullEmergencyMode();
      setResult(res);
      setLogs(res.logs || []);
      setPhase('active');
      setPanelOpen(true);
      setEmergency?.(true);
      setSyncCountdown(10);

      // Recalculate risk score (will increase it on Dashboard)
      await evaluateEmergency?.();

      speakAlert('Emergency mode activated. Volunteers dispatched to critical zones.');

      if (res.limitedData) {
        setError('⚠️ Emergency mode activated with limited data');
      }
    } catch (err) {
      console.error('[EmergencyMode] Activation failed', err);
      setError(err?.message || 'Activation failed');
      setPhase('idle');
    }
  }, [phase, setEmergency, speakAlert, evaluateEmergency]);

  // Deactivate handler
  const handleDeactivate = useCallback(() => {
    setPhase('idle');
    setPanelOpen(false);
    setResult(null);
    setLogs([]);
    setError(null);
    onDeactivateEmergency?.();
    try { window.speechSynthesis?.cancel(); } catch { /* */ }
  }, [onDeactivateEmergency]);

  const stats = result?.stats || { totalIncidents: 0, criticalZones: 0, volunteersDispatched: 0, averageETA: 0 };
  const assignments = result?.assignments || [];
  const zones = result?.zones || [];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ═══ EMERGENCY BUTTON ═══ */}
      <motion.button
        id="emergency-mode-btn"
        type="button"
        onClick={phase === 'active' ? () => setPanelOpen((p) => !p) : handleActivate}
        disabled={phase === 'loading'}
        whileHover={phase === 'loading' ? {} : { scale: 1.015 }}
        whileTap={phase === 'loading' ? {} : { scale: 0.985 }}
        className={phase === 'idle' ? 'emergency-pulse-btn' : ''}
        style={{
          width: '100%',
          padding: isMobile ? '18px 20px' : '22px 32px',
          borderRadius: 18,
          border: phase === 'active'
            ? '2px solid rgba(239,68,68,0.6)'
            : '2px solid rgba(239,68,68,0.3)',
          fontSize: isMobile ? 15 : 17,
          fontWeight: 800,
          fontFamily: "'Inter', system-ui, sans-serif",
          cursor: phase === 'loading' ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#fff',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          position: 'relative',
          overflow: 'hidden',
          background: phase === 'active'
            ? 'linear-gradient(135deg, #991B1B, #DC2626)'
            : phase === 'loading'
              ? 'linear-gradient(135deg, #92400E, #B45309)'
              : 'linear-gradient(135deg, #DC2626 0%, #EA580C 50%, #F97316 100%)',
          boxShadow: phase === 'active'
            ? '0 0 40px rgba(239,68,68,0.4), 0 0 80px rgba(239,68,68,0.15)'
            : phase === 'loading'
              ? '0 8px 30px rgba(180,83,9,0.4)'
              : '0 0 30px rgba(239,68,68,0.35), 0 8px 32px rgba(234,88,12,0.25)',
          transition: 'background 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Ripple on click */}
        {phase === 'loading' && (
          <motion.div
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              position: 'absolute', width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
            }}
          />
        )}

        {phase === 'loading' && (
          <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite' }} />
        )}

        {phase === 'active' && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ width: 10, height: 10, borderRadius: '50%', background: '#F87171', flexShrink: 0 }}
          />
        )}

        {phase === 'idle' && <ShieldAlert size={22} />}

        <span>
          {phase === 'loading' && 'Analyzing situation…'}
          {phase === 'active' && 'EMERGENCY ACTIVE'}
          {phase === 'idle' && 'ACTIVATE EMERGENCY RESPONSE'}
        </span>

        {phase === 'active' && (panelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />)}
      </motion.button>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 10, padding: '10px 16px', borderRadius: 12,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <AlertTriangle size={15} /> {error}
        </motion.div>
      )}

      {/* ═══ DASHBOARD PANEL ═══ */}
      <AnimatePresence>
        {phase === 'active' && panelOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden', marginTop: 16 }}
          >
            <div style={{
              background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: 20, border: '1px solid rgba(239,68,68,0.25)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3), 0 0 60px rgba(239,68,68,0.08)',
              overflow: 'hidden',
            }}>
              {/* Top bar accent */}
              <div style={{
                height: 4, background: 'linear-gradient(90deg, #EF4444, #F97316, #EF4444)',
                backgroundSize: '200% 100%', animation: 'emergencyBarShift 2s linear infinite',
              }} />

              {/* Header */}
              <div style={{
                padding: isMobile ? '16px 16px 12px' : '20px 24px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}>
                    <Siren size={20} color="#F87171" />
                  </motion.div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#F87171', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                      Emergency Response Dashboard
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      Activated {result?.activatedAt ? new Date(result.activatedAt).toLocaleTimeString() : 'now'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <RefreshCw size={12} /> Sync in {syncCountdown}s
                  </div>
                  <button onClick={handleDeactivate} style={{
                    padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                    cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                  }}>✕ Deactivate</button>
                </div>
              </div>

              {/* Stat cards row */}
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
                gap: 12, padding: isMobile ? 12 : '16px 24px',
              }}>
                {[
                  { icon: <Activity size={18} />, label: 'Active Incidents', value: stats.totalIncidents, color: '#EF4444' },
                  { icon: <MapPin size={18} />, label: 'Critical Zones', value: stats.criticalZones, color: '#F59E0B' },
                  { icon: <Users size={18} />, label: 'Dispatched', value: stats.volunteersDispatched, color: '#10B981' },
                  { icon: <Clock size={18} />, label: 'Avg ETA', value: `${stats.averageETA}m`, color: '#3B82F6' },
                ].map((s) => (
                  <div key={s.label} style={{
                    padding: isMobile ? 12 : 16, borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: s.color }}>{s.icon}
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Assignments + Zones grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 16, padding: isMobile ? '0 12px 12px' : '0 24px 20px',
              }}>
                {/* Volunteers Dispatched */}
                <div style={{
                  borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '1px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Users size={14} /> Volunteers Dispatched ({assignments.length})
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                    {assignments.length === 0 && (
                      <div style={{ padding: 16, color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' }}>No assignments yet</div>
                    )}
                    {assignments.map((a, i) => (
                      <div key={i} style={{
                        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        borderBottom: i < assignments.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: '#10B981', flexShrink: 0,
                        }}>
                          {a.volunteer.name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.volunteer.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            → {a.task.location} · {Number.isFinite(a.distanceKm) ? `${a.distanceKm.toFixed(1)}km` : 'nearby'}
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                          background: 'rgba(59,130,246,0.15)', color: '#60A5FA',
                        }}>
                          ~{a.etaMinutes}m
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critical Zones */}
                <div style={{
                  borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '1px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <MapPin size={14} /> Critical Zones ({zones.length})
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 0' }}>
                    {zones.length === 0 && (
                      <div style={{ padding: 16, color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' }}>No zones detected</div>
                    )}
                    {zones.slice(0, 6).map((z, i) => (
                      <div key={i} style={{
                        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        borderBottom: i < Math.min(zones.length, 6) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}>
                        <motion.div
                          animate={z.severity === 'critical' ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          style={{
                            width: 10, height: 10, borderRadius: '50%', background: z.color || '#F59E0B', flexShrink: 0,
                            boxShadow: `0 0 8px ${z.color || '#F59E0B'}`,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{z.region}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            {z.taskCount} task{z.taskCount !== 1 ? 's' : ''} · {z.urgentCount} urgent
                          </div>
                        </div>
                        <div style={{
                          padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                          background: z.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: z.severity === 'critical' ? '#FCA5A5' : '#FCD34D',
                        }}>
                          {z.severity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                padding: isMobile ? '8px 12px 12px' : '8px 24px 16px',
                display: 'flex', gap: 10, flexWrap: 'wrap',
              }}>
                <button onClick={() => onNav?.('map')} style={{
                  padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)',
                  cursor: 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Radio size={14} /> View Map
                </button>
                <button onClick={() => onNav?.('tasks')} style={{
                  padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)',
                  cursor: 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <CheckCircle2 size={14} /> View Tasks
                </button>
                <button onClick={() => setLogsOpen((p) => !p)} style={{
                  padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', fontFamily: "'Inter',sans-serif", display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Terminal size={14} /> {logsOpen ? 'Hide' : 'Show'} Logs ({logs.length})
                </button>
              </div>

              {/* Activity Logs Panel */}
              <AnimatePresence>
                {logsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      margin: isMobile ? '0 12px 12px' : '0 24px 20px',
                      borderRadius: 14, background: '#0A0A0A', border: '1px solid #1E1E1E', overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '10px 16px', borderBottom: '1px solid #1E1E1E',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                        <span style={{ fontSize: 11, color: '#71717a', marginLeft: 8, fontFamily: "'SF Mono', monospace" }}>
                          emergency-log.sh
                        </span>
                      </div>
                      <div style={{
                        padding: 16, maxHeight: 240, overflowY: 'auto',
                        fontFamily: "'SF Mono', ui-monospace, monospace", fontSize: 12, lineHeight: 1.8,
                      }}>
                        {logs.map((log, i) => (
                          <div key={i} style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ color: '#8B5CF6', userSelect: 'none' }}>❯ </span>
                            <span style={{
                              color: log.action.includes('FAIL') || log.action.includes('ERROR') ? '#EF4444'
                                : log.action.includes('COMPLETE') || log.action.includes('ACTIVE') ? '#10B981'
                                : log.action.includes('ASSIGN') ? '#3B82F6'
                                : '#F59E0B',
                              fontWeight: 600,
                            }}>
                              [{log.action}]
                            </span>
                            {' '}{log.detail}
                            <span style={{ color: '#3f3f46', marginLeft: 8 }}>
                              {new Date(log.time).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
