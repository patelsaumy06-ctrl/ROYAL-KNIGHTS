import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Users, MapPin, AlertTriangle, UploadCloud, CheckCircle, ArrowRight,
  Activity, Zap, Brain, Shield, FileText, Clock, Target, Sparkles,
} from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import CrisisSimulator from '../components/CrisisSimulator';
import Footer from '../components/Footer';

/* ── Animation helpers ──────────────────────────────────────────────── */
const ease = [0.16, 1, 0.3, 1];
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease },
});
const fadeInView = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, delay, ease },
});

/* ── Animated counter ───────────────────────────────────────────────── */
function AnimatedNumber({ value, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const num = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
          const duration = 1800;
          const startTime = performance.now();
          const animate = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(num * eased));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{prefix}{display.toLocaleString()}{suffix}</span>;
}

/* ── Main Landing ───────────────────────────────────────────────────── */
export default function Landing({ onNav }) {
  const { isMobile, isTablet } = useMediaQuery();

  const features = [
    { icon: <Brain size={26} color="#3B82F6" />, title: 'Smart Triage', desc: 'Upload a flood report. Get severity, location, and priority classification in 30 seconds — powered by Gemini AI.', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
    { icon: <Users size={26} color="#10B981" />, title: 'Volunteer Auto-Deploy', desc: 'AI matches volunteers by skill, proximity, and availability. No manual coordination needed — just confirm and dispatch.', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    { icon: <MapPin size={26} color="#F59E0B" />, title: 'Live Crisis Map', desc: 'See every incident on a real-time, color-coded map. Zoom into hotspots. Identify resource gaps at a glance.', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
    { icon: <AlertTriangle size={26} color="#EF4444" />, title: 'Emergency Mode', desc: 'When crisis escalates, Emergency Mode auto-dispatches nearest volunteers, highlights critical zones, and activates rapid response.', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
    { icon: <UploadCloud size={26} color="#8B5CF6" />, title: 'Multi-Format Ingestion', desc: 'Import CSV files, scanned paper surveys, structured reports — AI parses and classifies everything automatically.', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
    { icon: <Shield size={26} color="#14B8A6" />, title: 'Offline-Ready', desc: 'Built for the field. Works offline, syncs when connectivity returns. Never lose critical data during a crisis.', bg: 'rgba(20,184,166,0.1)', border: 'rgba(20,184,166,0.2)' },
  ];

  const howItWorks = [
    { icon: <FileText size={22} />, label: 'Upload', desc: 'Drop CSV, scanned forms, or structured reports', color: '#8B5CF6' },
    { icon: <Brain size={22} />, label: 'AI Analyzes', desc: 'Gemini classifies urgency, location, and need type', color: '#2563EB' },
    { icon: <MapPin size={22} />, label: 'Map Visualizes', desc: 'Crisis hotspots appear on a live, color-coded map', color: '#F59E0B' },
    { icon: <Users size={22} />, label: 'Volunteers Match', desc: 'AI pairs nearest, most-skilled responders', color: '#10B981' },
    { icon: <CheckCircle size={22} />, label: 'Track Impact', desc: 'Real-time dashboards show resolution rates', color: '#14B8A6' },
  ];

  const testimonials = [
    { quote: 'NeedLink AI helped us process 400+ field reports during cyclone season in under 2 hours. Previously that took our team 3 full days.', name: 'Anika Patel', role: 'Program Director', org: 'Gujarat Community Relief Network', initials: 'AP', color: '#6366F1' },
    { quote: 'The volunteer matching alone saved us dozens of phone calls per incident. We just confirm the AI suggestions and dispatch.', name: 'Rajesh Mehta', role: 'Field Coordinator', org: 'Disaster Response Initiative', initials: 'RM', color: '#10B981' },
    { quote: 'We finally have a single dashboard that shows our donors exactly where resources are going and what impact we\'re creating.', name: 'Sunita Rao', role: 'Operations Lead', org: 'Community Care Foundation', initials: 'SR', color: '#F59E0B' },
  ];

  return (
    <div style={{ minHeight: '100%', background: '#FAFCFF', position: 'relative', overflow: 'hidden' }}>
      {/* Background decorations */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 70%)', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: '20%', right: '-20%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0) 70%)', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '20%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0) 70%)', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.4 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: isMobile ? '40px 16px 0' : isTablet ? '60px 24px 0' : '80px 32px 80px' }}>

        {/* ═══════════════════════ SECTION 1: HERO ═══════════════════════ */}
        <section style={{ textAlign: 'center', paddingTop: isMobile ? 20 : 60, paddingBottom: isMobile ? 48 : 80 }}>
          <motion.div {...fadeUp(0)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 8px 32px rgba(37,99,235,0.1)', backdropFilter: 'blur(16px)', borderRadius: 100, padding: isMobile ? '8px 16px' : '10px 24px', fontSize: isMobile ? 12 : 13, color: '#2563EB', fontWeight: 700, marginBottom: isMobile ? 24 : 36 }}>
              <Zap size={18} color="#2563EB" fill="#2563EB" />
              AI-Powered Humanitarian Response Platform
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 'clamp(32px, 8vw, 42px)' : 'clamp(46px, 6.5vw, 80px)', lineHeight: 1.1, color: '#0F172A', marginBottom: isMobile ? 20 : 28, maxWidth: 950, margin: '0 auto 28px', letterSpacing: '-0.02em', padding: isMobile ? '0 8px' : 0 }}
          >
            When Disaster Strikes, Every{' '}
            <span style={{ background: 'linear-gradient(135deg, #2563EB, #8B5CF6, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontStyle: 'italic' }}>
              Minute Counts
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            style={{ fontSize: isMobile ? 15 : 19, color: '#475569', maxWidth: 640, margin: '0 auto 48px', lineHeight: 1.8, padding: isMobile ? '0 12px' : 0 }}
          >
            NeedLink AI turns scattered field reports into prioritized crisis alerts — matching the
            right volunteers to the right crisis in seconds, not hours.
          </motion.p>

          <motion.div
            {...fadeUp(0.3)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 12 : 24, flexDirection: isMobile ? 'column' : 'row', padding: isMobile ? '0 16px' : 0 }}
          >
            <button
              onClick={() => onNav('dashboard')}
              style={{
                background: 'linear-gradient(135deg, #2563EB, #4F46E5)', color: '#fff', border: 'none', borderRadius: 100,
                padding: isMobile ? '16px 32px' : '18px 40px', fontSize: isMobile ? 15 : 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', boxShadow: '0 20px 40px -10px rgba(37,99,235,0.6)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: "'DM Sans', sans-serif", width: isMobile ? '100%' : 'auto', justifyContent: 'center', minHeight: 52,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 24px 48px -10px rgba(37,99,235,0.7)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(37,99,235,0.6)'; }}
            >
              Start Managing Crises <ArrowRight size={22} />
            </button>
            <button
              onClick={() => {
                document.getElementById('crisis-simulator')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: 'rgba(255,255,255,0.8)', color: '#0F172A', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 100,
                padding: isMobile ? '16px 32px' : '18px 40px', fontSize: isMobile ? 15 : 16, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 10px 20px -10px rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                fontFamily: "'DM Sans', sans-serif", width: isMobile ? '100%' : 'auto', justifyContent: 'center', minHeight: 52,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
            >
              Watch How It Works
            </button>
          </motion.div>
        </section>

        {/* ═══════════════════════ SECTION 2: SOCIAL PROOF BAR ═══════════════════════ */}
        <motion.div
          {...fadeInView(0)}
          style={{ textAlign: 'center', marginBottom: isMobile ? 48 : 80, padding: isMobile ? '0 8px' : 0 }}
        >
          <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 20 }}>
            Trusted by humanitarian organizations across Gujarat
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? 24 : 48, flexWrap: 'wrap', opacity: 0.4 }}>
            {['Gujarat Relief Network', 'Community Care Foundation', 'Disaster Response Initiative', 'Rural Health Alliance'].map((org) => (
              <div key={org} style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{org}</div>
            ))}
          </div>
        </motion.div>

        {/* ═══════════════════════ SECTION 3: THE PROBLEM ═══════════════════════ */}
        <motion.section
          {...fadeInView(0)}
          style={{
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)',
            borderRadius: isMobile ? 20 : 32, padding: isMobile ? '32px 20px' : '56px 48px', marginBottom: isMobile ? 48 : 80,
            boxShadow: '0 20px 40px rgba(0,0,0,0.04)', position: 'relative', zIndex: 2,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 48, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 100, padding: '6px 14px', fontSize: 11, color: '#DC2626', fontWeight: 700, marginBottom: 20 }}>
                <AlertTriangle size={13} /> THE COST OF SLOW RESPONSE
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 24 : 34, color: '#0F172A', lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
                NGOs lose critical hours sorting paper reports during emergencies
              </h2>
              <p style={{ fontSize: isMobile ? 14 : 16, color: '#475569', lineHeight: 1.8, marginBottom: 24 }}>
                When Cyclone Biparjoy hit Gujarat, NGOs received 2,400+ field reports in 48 hours. Teams
                spent <strong>6+ hours manually sorting paper forms</strong> before they could deploy a single
                volunteer. NeedLink AI processes them in minutes.
              </p>
              <div style={{ display: 'flex', gap: isMobile ? 16 : 24, flexWrap: 'wrap' }}>
                {[
                  { before: '6 hours', after: '4 min', label: 'Report Processing' },
                  { before: 'Manual', after: 'AI-Auto', label: 'Volunteer Matching' },
                  { before: 'Paper', after: 'Real-time', label: 'Crisis Visibility' },
                ].map((item) => (
                  <div key={item.label} style={{ flex: '1 1 120px', padding: 16, background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: '#94A3B8', textDecoration: 'line-through' }}>{item.before}</span>
                      <ArrowRight size={12} color="#94A3B8" />
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#2563EB' }}>{item.after}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right side: stat highlight */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderRadius: 24, padding: isMobile ? '32px 20px' : '48px 32px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Clock size={32} color="#60A5FA" style={{ marginBottom: 16 }} />
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: isMobile ? 48 : 64, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    90<span style={{ fontSize: isMobile ? 28 : 36, color: '#60A5FA' }}>%</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Faster crisis response time</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>compared to manual coordination</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════════════════════ SECTION 4: HOW IT WORKS ═══════════════════════ */}
        <section style={{ marginBottom: isMobile ? 48 : 80 }}>
          <motion.div {...fadeInView(0)} style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 100, padding: '6px 14px', fontSize: 11, color: '#2563EB', fontWeight: 700, marginBottom: 16 }}>
              <Target size={13} /> HOW IT WORKS
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 'clamp(24px, 6vw, 30px)' : 'clamp(30px, 4vw, 42px)', color: '#0F172A', marginBottom: 12 }}>
              From Field Report to First Responder
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 17, color: '#64748B', maxWidth: 560, margin: '0 auto' }}>
              Five steps. One platform. AI handles the complexity so your team can focus on saving lives.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: isMobile ? 16 : 20, position: 'relative', zIndex: 2 }}>
            {howItWorks.map((step, i) => (
              <motion.div
                key={step.label}
                {...fadeInView(i * 0.08)}
                style={{
                  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 20, padding: isMobile ? 20 : 24,
                  textAlign: 'center', backdropFilter: 'blur(16px)', boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                  position: 'relative',
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: 8, background: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800, margin: '0 auto 12px', boxShadow: `0 4px 12px ${step.color}33` }}>
                  {i + 1}
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: `${step.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.color, margin: '0 auto 14px' }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>{step.label}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6 }}>{step.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ SECTION 5: CRISIS SIMULATOR ═══════════════════════ */}
        <motion.section {...fadeInView(0)} id="crisis-simulator" style={{ marginBottom: isMobile ? 48 : 80, scrollMarginTop: 40 }}>
          <CrisisSimulator />
        </motion.section>

        {/* ═══════════════════════ SECTION 6: FEATURES GRID ═══════════════════════ */}
        <section style={{ marginBottom: isMobile ? 48 : 80 }}>
          <motion.div {...fadeInView(0)} style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 100, padding: '6px 14px', fontSize: 11, color: '#10B981', fontWeight: 700, marginBottom: 16 }}>
              <Sparkles size={13} /> PLATFORM CAPABILITIES
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 'clamp(24px, 6vw, 30px)' : 'clamp(30px, 4vw, 42px)', color: '#0F172A', marginBottom: 12 }}>
              Built for Real-World Humanitarian Response
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 17, color: '#64748B', maxWidth: 560, margin: '0 auto' }}>
              Every feature designed with NGO field workers, disaster coordinators, and volunteer managers in mind.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? 16 : 24, position: 'relative', zIndex: 2 }}>
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeInView(i * 0.08)}
                whileHover={!isMobile ? { y: -8, scale: 1.01, transition: { duration: 0.3, ease: 'easeOut' } } : {}}
                style={{
                  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)', borderTop: `1px solid ${f.border}`, borderLeft: `1px solid ${f.border}`,
                  borderRadius: isMobile ? 20 : 24, padding: isMobile ? 24 : 32, boxShadow: '0 12px 30px rgba(0,0,0,0.03), inset 0 0 0 1px rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', cursor: 'default',
                }}
              >
                <div style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, background: f.bg, borderRadius: isMobile ? 14 : 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMobile ? 16 : 22 }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: '#0F172A', marginBottom: isMobile ? 8 : 10, letterSpacing: '-0.01em' }}>{f.title}</div>
                <div style={{ fontSize: isMobile ? 13 : 14.5, color: '#475569', lineHeight: 1.7, flex: 1 }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ SECTION 7: IMPACT STATS ═══════════════════════ */}
        <motion.div
          {...fadeInView(0)}
          style={{
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)',
            borderRadius: isMobile ? 20 : 32, padding: isMobile ? '32px 16px' : '52px 32px',
            display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: isMobile ? 20 : 30,
            boxShadow: '0 20px 40px rgba(0,0,0,0.04)', marginBottom: isMobile ? 48 : 80, position: 'relative', zIndex: 2,
          }}
        >
          {[
            ['1240', '+', 'Active Volunteers', '#2563EB'],
            ['89', '%', 'Resolution Rate', '#10B981'],
            ['342', '+', 'Needs Resolved', '#8B5CF6'],
            ['28', '', 'Districts Covered', '#F59E0B'],
          ].map(([n, suffix, l, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: isMobile ? '0 8px' : '0 20px', flex: isMobile ? '1 1 40%' : '1 1 200px' }}>
              <div style={{ fontSize: isMobile ? 'clamp(28px, 6vw, 36px)' : 'clamp(36px, 4vw, 48px)', fontWeight: 800, color: c, fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.03em', marginBottom: 8 }}>
                <AnimatedNumber value={n} suffix={suffix} />
              </div>
              <div style={{ fontSize: isMobile ? 12 : 14, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
            </div>
          ))}
        </motion.div>

        {/* ═══════════════════════ SECTION 8: TESTIMONIALS ═══════════════════════ */}
        <section style={{ marginBottom: isMobile ? 48 : 80 }}>
          <motion.div {...fadeInView(0)} style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 40 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 'clamp(24px, 6vw, 30px)' : 'clamp(30px, 4vw, 42px)', color: '#0F172A', marginBottom: 12 }}>
              Voices from the Field
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color: '#64748B', maxWidth: 480, margin: '0 auto' }}>
              Hear from humanitarian teams using NeedLink AI to accelerate their crisis response.
            </p>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 16 : 24, position: 'relative', zIndex: 2 }}>
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                {...fadeInView(i * 0.1)}
                style={{
                  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 20,
                  padding: isMobile ? 24 : 28, backdropFilter: 'blur(16px)', boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 28, color: '#CBD5E1', marginBottom: 12, fontFamily: 'Georgia, serif' }}>"</div>
                <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.75, flex: 1, marginBottom: 20 }}>{t.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${t.color}, ${t.color}CC)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>{t.role}, {t.org}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ SECTION 9: FINAL CTA ═══════════════════════ */}
        <motion.section
          {...fadeInView(0)}
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
            borderRadius: isMobile ? 20 : 32, padding: isMobile ? '40px 20px' : '64px 48px',
            textAlign: 'center', position: 'relative', overflow: 'hidden', marginBottom: isMobile ? 0 : 80,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          <div style={{ position: 'absolute', top: '-30%', right: '10%', width: '40%', height: '60%', background: 'radial-gradient(circle,rgba(37,99,235,0.2),transparent 70%)', borderRadius: '50%', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 24 : 36, color: '#fff', marginBottom: 16, letterSpacing: '-0.02em' }}>
              Ready to Transform Your Crisis Response?
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 17, color: 'rgba(255,255,255,0.5)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
              Join NGOs across Gujarat who are using AI to respond faster, coordinate better, and save more lives.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexDirection: isMobile ? 'column' : 'row', padding: isMobile ? '0 12px' : 0 }}>
              <button
                onClick={() => onNav('dashboard')}
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #4F46E5)', color: '#fff', border: 'none', borderRadius: 100,
                  padding: '16px 36px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 16px 40px -10px rgba(37,99,235,0.5)', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.3s', minHeight: 52,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Create Free Account <ArrowRight size={18} />
              </button>
              <button
                onClick={() => onNav('contact')}
                style={{
                  background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 100,
                  padding: '16px 36px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.3s', minHeight: 52,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              >
                Schedule a Demo
              </button>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ═══════════════════════ SECTION 10: FOOTER ═══════════════════════ */}
      <Footer onNav={onNav} />
    </div>
  );
}
