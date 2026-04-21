import { AlertTriangle, Brain, MapPin, Siren, TrendingUp } from 'lucide-react';
import { G, css } from '../styles/theme';

const getUrgencyColor = (level) => {
  if (level === 'critical') return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
  if (level === 'high') return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' };
  if (level === 'medium') return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
  return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
};

export default function PredictionDashboard({ predictions = [], hotspots = [], smartMode = false, onNav }) {
  const urgencyCounts = predictions.reduce(
    (acc, item) => {
      const key = String(item.urgencyLevel || 'low').toLowerCase();
      if (key === 'critical') acc.critical += 1;
      else if (key === 'high') acc.high += 1;
      else if (key === 'medium') acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  const avgConfidence = predictions.length
    ? Math.round(predictions.reduce((sum, item) => sum + (Number(item.confidenceScore) || 0), 0) / predictions.length)
    : 0;
  const topPrediction = predictions[0] || null;
  const topHotspots = hotspots.slice(0, 3);

  return (
    <div style={{ ...css.card(), marginBottom: 24, border: '1px solid #DBEAFE' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${G.border}`,
          ...css.flex(0, 'center', 'space-between'),
          background: 'linear-gradient(135deg,#EFF6FF,#EEF2FF)',
        }}
      >
        <div>
          <div style={{ ...css.flex(8), fontSize: 14, fontWeight: 700, color: G.blue }}>
            <Brain size={16} />
            Prediction Dashboard
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: G.t2 }}>
            Forecasting demand, escalation risk, and likely hotspot pressure.
          </div>
        </div>
        <div style={{ ...css.tag('#DBEAFE', G.blue), border: '1px solid #BFDBFE' }}>
          {smartMode ? 'AI Recommended' : 'Manual Mode'}
        </div>
      </div>

      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
          <div style={{ ...css.flex(8), color: G.t1, fontWeight: 700, fontSize: 13 }}>
            <Siren size={15} color={G.red} />
            Forecast Snapshot
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: G.t2 }}>
            Active predictions: <strong style={{ color: G.t1 }}>{predictions.length}</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: G.t2 }}>
            Avg confidence: <strong style={{ color: G.blue }}>{avgConfidence}%</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: G.t2 }}>
            Leading signal:{' '}
            <strong style={{ color: G.t1 }}>
              {topPrediction ? `${topPrediction.predictedNeedType} in ${topPrediction.location}` : 'No active forecast'}
            </strong>
          </div>
        </div>

        <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
          <div style={{ ...css.flex(8), color: G.t1, fontWeight: 700, fontSize: 13 }}>
            <AlertTriangle size={15} color={G.amber} />
            Urgency Mix
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {['critical', 'high', 'medium', 'low'].map((level) => {
              const palette = getUrgencyColor(level);
              return (
                <div
                  key={level}
                  style={{
                    ...css.flex(8, 'center', 'space-between'),
                    background: palette.bg,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 10,
                    padding: '5px 9px',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: palette.text, fontWeight: 700, textTransform: 'capitalize' }}>{level}</span>
                  <span style={{ fontSize: 11.5, color: palette.text, fontWeight: 700 }}>{urgencyCounts[level]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ border: `1px solid ${G.border}`, borderRadius: 12, padding: '12px 14px', background: '#fff' }}>
          <div style={{ ...css.flex(8), color: G.t1, fontWeight: 700, fontSize: 13 }}>
            <TrendingUp size={15} color={G.blue} />
            Top Predicted Areas
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {topHotspots.map((spot) => (
              <div key={spot.region} style={{ ...css.flex(8, 'center', 'space-between') }}>
                <div style={{ ...css.flex(5), fontSize: 12, color: G.t1, fontWeight: 600 }}>
                  <MapPin size={12} color={G.t3} />
                  {spot.region}
                </div>
                <div style={{ ...css.tag('#FEE2E2', '#991B1B') }}>{spot.score}</div>
              </div>
            ))}
            {topHotspots.length === 0 && <div style={{ fontSize: 12, color: G.t3 }}>No hotspot forecast yet.</div>}
          </div>
        </div>
      </div>

      {topPrediction && (
        <div style={{ borderTop: `1px solid ${G.border}`, padding: '12px 18px', ...css.flex(8, 'center', 'space-between') }}>
          <div style={{ fontSize: 12.5, color: G.t2 }}>
            <strong style={{ color: G.t1 }}>Next likely escalation:</strong> {topPrediction.reason}
          </div>
          <button style={css.btn('primary', true)} onClick={() => onNav?.('tasks')}>
            View Priority Tasks
          </button>
        </div>
      )}
    </div>
  );
}
