import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  MapPin,
  Award,
  Clock,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Brain,
} from 'lucide-react';
import Avatar from '../Avatar';
import SkillRadarChart from '../SkillRadarChart';

export default function VolunteerCard({
  volunteer,
  index,
  selectedNeed,
  travelTime,
  expanded,
  onToggleExpand,
  assigning,
  assigned,
  assignSuccess,
  onAssign,
  aiExplanation,
  aiExplanationLoading,
  G,
  css,
  fadeIn,
}) {
  const assignmentScore = Number.isFinite(Number(volunteer.assignmentScore)) ? Math.max(0, Math.min(1, Number(volunteer.assignmentScore))) : 0;
  const assignmentPercent = Math.round(assignmentScore * 100);
  const safeSkillScore = Number.isFinite(Number(volunteer.skillScore)) ? Number(volunteer.skillScore) : assignmentScore;
  const dynamicDistMatches = travelTime?.distance ? travelTime.distance.match(/[\d.]+/) : null;
  const currentDistance = dynamicDistMatches ? parseFloat(dynamicDistMatches[0]) : volunteer.distanceKm ?? volunteer.distance;
  const taskName = selectedNeed?.category || 'selected task';
  // Use AI-generated explanation when available, fall back to template reasoning
  const fallbackReasoning = `Matched based on "${volunteer.skill}" expertise being highly relevant to the "${taskName}". ${
    currentDistance < 5
      ? 'Exceptional proximity allows for rapid deployment within 30 minutes.'
      : 'Strategic placement within the region and proven track record with complex logistics.'
  }`;
  const reasoning = aiExplanation || fallbackReasoning;

  return (
    <motion.div
      {...fadeIn(0.05 + index * 0.03)}
      layout
      whileHover={{ y: -8, boxShadow: G.shadowLg }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        ...css.card(),
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
        gridColumn: expanded ? 'span 3' : 'span 1',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg,${
            assignmentScore >= 0.72 ? G.green : assignmentScore >= 0.52 ? G.amber : G.red
          },transparent)`,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Avatar initials={volunteer.initials} color={volunteer.color} size={52} />
          {volunteer.available && (
            <div
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: G.green,
                border: '2.5px solid #fff',
                boxShadow: `0 0 0 2px ${G.greenLight}`,
              }}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: G.t1, letterSpacing: '-0.01em' }}>{volunteer.name}</div>
          <div style={{ fontSize: 12.5, color: G.t3, marginTop: 2 }}>{volunteer.skill}</div>
          <div style={{ color: '#F59E0B', fontSize: 12, marginTop: 3, letterSpacing: '1px' }}>
            {'★'.repeat(volunteer.rating)}
            {'☆'.repeat(5 - volunteer.rating)}
          </div>
        </div>
        <div
          style={{
            textAlign: 'center',
            background: `linear-gradient(135deg,${
              assignmentScore >= 0.72
                ? G.greenLight
                : assignmentScore >= 0.52
                ? G.amberLight
                : G.redLight
            },transparent)`,
            padding: '8px 14px',
            borderRadius: 14,
            border: `1px solid ${
              assignmentScore >= 0.72 ? '#A7F3D0' : assignmentScore >= 0.52 ? '#FDE68A' : '#FECACA'
            }`,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: assignmentScore >= 0.72 ? G.green : assignmentScore >= 0.52 ? G.amber : G.red,
              lineHeight: 1,
            }}
          >
            {assignmentPercent}%
          </div>
          <div style={{ fontSize: 9, color: G.t3, fontWeight: 600, marginTop: 2 }}>AI Match</div>
        </div>
      </div>

      <div style={{ background: G.bg, borderRadius: 100, height: 5, marginBottom: 18, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${assignmentPercent}%` }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.05, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 100,
            background: `linear-gradient(90deg,${G.blue},${assignmentScore >= 0.72 ? G.green : G.amber})`,
          }}
        />
      </div>
      {volunteer.aiMatchReasons?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {volunteer.aiMatchReasons.map((reason) => (
            <div
              key={reason}
              style={{ fontSize: 11.5, color: G.t3, background: G.bg, border: `1px solid ${G.borderLight}`, borderRadius: 10, padding: '6px 10px' }}
            >
              {reason}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '20px 0', borderTop: `1px solid ${G.borderLight}` }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Brain size={16} color={G.blue} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: G.t1, textTransform: 'uppercase' }}>AI Compatibility Matrix</span>
                </div>
                <SkillRadarChart
                  data={[
                    { subject: 'Skill Alignment', A: Math.round(safeSkillScore * 100), fullMark: 100 },
                    { subject: 'Proximity', A: Math.max(0, 100 - currentDistance * 2), fullMark: 100 },
                    { subject: 'Reliability', A: volunteer.rating * 20, fullMark: 100 },
                    { subject: 'Past Performance', A: Math.min(100, volunteer.tasks * 5), fullMark: 100 },
                    { subject: 'Response Time', A: 85, fullMark: 100 },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: G.bg, borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: G.t1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    AI Reasoning
                    {aiExplanation && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: G.blueLight, color: G.blueDark, letterSpacing: '0.5px' }}>LLM-GENERATED</span>
                    )}
                    {aiExplanationLoading && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: G.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${G.blueLight}`, borderTopColor: G.blue, animation: 'spin 1s linear infinite' }} />
                        Generating...
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: G.t2, lineHeight: 1.6 }}>{reasoning}</div>
                </div>
                <div style={{ background: G.bg, borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: G.t1, marginBottom: 8 }}>Recent Missions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['Flood Relief (Sidhpur)', 'Water Supply (Rajpur)'].map((mission) => (
                      <div key={mission} style={{ fontSize: 11.5, color: G.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={12} color={G.green} /> {mission}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <div style={{ background: G.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            <Clock size={11} color={G.blue} />
            <span style={{ fontSize: 10, color: G.t3, fontWeight: 600 }}>Travel</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: G.blue }}>{travelTime?.durationInTraffic || '...'}</div>
        </div>
        <div style={{ background: G.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            <Navigation size={11} color={G.t2} />
            <span style={{ fontSize: 10, color: G.t3, fontWeight: 600 }}>Dist.</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: G.t1 }}>{travelTime?.distance || `${volunteer.distance} km`}</div>
        </div>
        <div style={{ background: G.bg, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            <Award size={11} color={G.amber} />
            <span style={{ fontSize: 10, color: G.t3, fontWeight: 600 }}>Tasks</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: G.t1 }}>{volunteer.tasks}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {currentDistance < 5 && (
          <span style={{ ...css.tag(G.blueLight, '#1D4ED8'), fontSize: 10 }}>
            <MapPin size={10} />
            Nearby
          </span>
        )}
        <span style={{ ...css.tag(G.greenLight, '#15803D'), fontSize: 10 }}>
          <CheckCircle2 size={10} />
          Skilled
        </span>
        {volunteer.available && (
          <span style={{ ...css.tag(G.amberLight, '#C2410C'), fontSize: 10 }}>
            <Zap size={10} />
            Available
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          disabled={assigning || assigned || !volunteer.available}
          onClick={() => onAssign(volunteer.id)}
          aria-label={`Assign ${volunteer.name} to ${selectedNeed?.category || 'task'}`}
          className={`transition-all duration-200 ${assigning ? 'animate-pulse' : ''}`}
          style={{
            ...css.btn(assigned ? 'secondary' : 'green'),
            flex: 1,
            justifyContent: 'center',
            fontSize: 13,
            borderRadius: 12,
            opacity: !volunteer.available ? 0.5 : 1,
            cursor: !volunteer.available ? 'not-allowed' : 'pointer',
            padding: '12px 14px',
          }}
        >
          {assigning ? 'Finding best volunteer...' : assigned ? <><CheckCircle2 size={15} /> Assigned</> : <><Zap size={15} /> Assign</>}
        </button>
        <button
          onClick={onToggleExpand}
          aria-label={expanded ? 'Collapse volunteer details' : 'Expand volunteer details'}
          style={{ ...css.btn('secondary', true), width: 44, height: 44, padding: 0, justifyContent: 'center', borderRadius: 12 }}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      {assignSuccess && (
        <p role="status" aria-live="polite" className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          Volunteer assigned successfully
        </p>
      )}
    </motion.div>
  );
}
