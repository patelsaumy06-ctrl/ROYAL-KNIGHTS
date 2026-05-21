import { G } from '../styles/theme';
import { useMediaQuery } from '../hooks/useMediaQuery';

/* ── Shimmer keyframes (injected once) ──────────────────────────────── */
const SHIMMER_ID = 'needlink-shimmer-style';
if (typeof document !== 'undefined' && !document.getElementById(SHIMMER_ID)) {
  const style = document.createElement('style');
  style.id = SHIMMER_ID;
  style.textContent = `
    @keyframes needlink-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

const shimmerBg = {
  background: `linear-gradient(90deg, ${G.bg} 25%, #E2E8F0 50%, ${G.bg} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'needlink-shimmer 1.8s ease-in-out infinite',
};

/* ── Base Pulse ─────────────────────────────────────────────────────── */
export function SkeletonPulse({ width = '100%', height = 16, borderRadius = 8, style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        ...shimmerBg,
        ...style,
      }}
    />
  );
}

/* ── Stat Card Skeleton ─────────────────────────────────────────────── */
export function SkeletonCard() {
  return (
    <div
      style={{
        background: G.surface,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <SkeletonPulse width={40} height={40} borderRadius={12} />
      <SkeletonPulse width="60%" height={12} />
      <SkeletonPulse width="40%" height={28} borderRadius={6} />
      <SkeletonPulse width="80%" height={10} />
    </div>
  );
}

/* ── Text Skeleton ──────────────────────────────────────────────────── */
export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse
          key={i}
          width={i === lines - 1 ? '65%' : '100%'}
          height={12}
        />
      ))}
    </div>
  );
}

/* ── Table Skeleton ─────────────────────────────────────────────────── */
export function SkeletonTable({ rows = 5 }) {
  return (
    <div
      style={{
        background: G.surface,
        border: `1px solid ${G.border}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 22px',
          borderBottom: `1px solid ${G.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SkeletonPulse width={180} height={16} />
        <SkeletonPulse width={80} height={30} borderRadius={10} />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 22px',
            borderBottom: i < rows - 1 ? `1px solid ${G.borderLight}` : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <SkeletonPulse width={32} height={32} borderRadius={8} />
          <SkeletonPulse width="25%" height={12} />
          <SkeletonPulse width="15%" height={12} />
          <SkeletonPulse width="20%" height={12} />
          <SkeletonPulse width={60} height={24} borderRadius={100} />
          <div style={{ flex: 1 }} />
          <SkeletonPulse width={70} height={30} borderRadius={10} />
        </div>
      ))}
    </div>
  );
}

/* ── Dashboard Skeleton (default export) ────────────────────────────── */
export default function SkeletonDashboard() {
  const { isMobile } = useMediaQuery();
  return (
    <div style={{ padding: isMobile ? '16px 12px' : '28px 32px' }}>
      {/* Welcome banner skeleton */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
          borderRadius: isMobile ? 16 : 20,
          padding: isMobile ? '24px 16px' : '32px 36px',
          marginBottom: isMobile ? 20 : 28,
        }}
      >
        <SkeletonPulse width={140} height={24} borderRadius={100} style={{ opacity: 0.2 }} />
        <div style={{ height: 12 }} />
        <SkeletonPulse width="50%" height={28} style={{ opacity: 0.15 }} />
        <div style={{ height: 10 }} />
        <SkeletonPulse width="70%" height={14} style={{ opacity: 0.1 }} />
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
          gap: isMobile ? 12 : 18,
          marginBottom: isMobile ? 20 : 28,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Table */}
      <SkeletonTable rows={4} />
    </div>
  );
}
