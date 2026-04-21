/**
 * Simplified Skill Radar Chart - Mini Version
 * Displays volunteer compatibility metrics in a clean, minimal format
 */
export default function SkillRadarChart({ data }) {
  if (!data || !data.length) return null;

  const average = Math.round(data.reduce((sum, item) => sum + (item.A || 0), 0) / data.length);
  const color = average >= 80 ? '#10B981' : average >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `conic-gradient(${color} ${average * 3.6}deg, #E5E7EB 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color }}>{average}%</span>
            <span style={{ fontSize: 9, color: '#6B7280' }}>Match</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {data.map((item) => (
          <div key={item.subject} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: (item.A || 0) >= 80 ? '#10B981' : (item.A || 0) >= 60 ? '#F59E0B' : '#EF4444',
              }}
            />
            <span style={{ fontSize: 10, color: '#6B7280', flex: 1 }}>{item.subject}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{item.A}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
