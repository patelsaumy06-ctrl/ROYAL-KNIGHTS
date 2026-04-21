import { useState, useMemo, useEffect } from 'react';
import { MapPin, List, Crosshair, X } from 'lucide-react';
import { addNeed } from '../services/firestoreRealtime';
import {
  REGION_ORDER,
  listSuggestions,
  resolveNeedCoordinates,
} from '../data/gujaratPlaces';
import MapLocationPicker from './MapLocationPicker';
import VoiceInputButton from './VoiceInputButton';
import { analyzeReport } from '../utils/reliefIntel';
import { validateNeed } from '../utils/validation';
import { analyzeIncidentReport, urgencyToPriority } from '../services/incidentAI';
import { useMediaQuery } from '../hooks/useMediaQuery';

const DK = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  muted: '#94a3b8',
  accent: '#38bdf8',
  accent2: '#a78bfa',
  danger: '#f87171',
};

export default function AddTaskModal({ onClose, onSave, initialDraft = null }) {
  const [form, setForm] = useState({
    category: '',
    location: '',
    region: 'Mehsana',
    priority: 'medium',
    volunteers: 5,
    deadline: '',
  });
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locTab, setLocTab] = useState('suggest');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reportText, setReportText] = useState('');
  const [urgencyScore, setUrgencyScore] = useState(30);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { isMobile } = useMediaQuery();

  useEffect(() => {
    if (!initialDraft) return;
    const r = initialDraft.region || 'Mehsana';
    setForm((f) => ({
      ...f,
      location: initialDraft.location || f.location,
      region: r,
    }));
    if (initialDraft.lat != null && initialDraft.lng != null) {
      setLat(initialDraft.lat);
      setLng(initialDraft.lng);
      setLocTab('map');
    }
  }, [initialDraft]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const suggestions = useMemo(() => listSuggestions(form.region), [form.region]);

  const applyPlace = (place) => {
    set('location', place.location);
    setLat(place.lat);
    setLng(place.lng);
    setError('');
  };

  const onRegionChange = (region) => {
    set('region', region);
    const loc = form.location.trim();
    const hit = listSuggestions(region).find((p) => p.location.toLowerCase() === loc.toLowerCase());
    if (hit) {
      setLat(hit.lat);
      setLng(hit.lng);
    } else {
      setLat(null);
      setLng(null);
    }
  };

  const handleSave = async () => {
    if (!form.category.trim() || !form.location.trim()) {
      setError('Category and location are required');
      return;
    }
    if (!form.deadline) {
      setError('Deadline required');
      return;
    }
    setSaving(true);
    try {
      const coords =
        lat != null && lng != null
          ? { lat: Number(lat), lng: Number(lng) }
          : resolveNeedCoordinates({
              location: form.location.trim(),
              region: form.region,
            });
      const newTask = {
        location: form.location.trim(),
        category: form.category.trim(),
        region: form.region,
        priority: form.priority,
        volunteers: parseInt(String(form.volunteers), 10) || 1,
        assigned: 0,
        status: 'open',
        deadline: form.deadline,
        lat: coords.lat,
        lng: coords.lng,
        reportText,
        urgencyScore,
        aiAnalysis,
      };
      const email = localStorage.getItem('ReliefLink_current_ngo_email');
      if (!email) throw new Error('Missing logged-in NGO email.');
      // Client-side guard: fail fast with user-friendly feedback before write attempts.
      const validation = validateNeed(newTask, { ngoEmail: email });
      if (!validation.isValid) {
        setError(Object.values(validation.errors)[0] || 'Please correct invalid fields.');
        return;
      }
      const docId = await addNeed(email, validation.sanitizedData);
      onSave({ ...validation.sanitizedData, id: docId });
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const applyReportAnalysis = (text) => {
    const result = analyzeReport(text);
    if (!form.category.trim() || form.category === 'Other') set('category', result.category);
    setUrgencyScore(result.score);
    if (result.score > 75) set('priority', 'urgent');
    else if (result.score >= 40) set('priority', 'medium');
    else set('priority', 'low');
  };

  const runAiAnalysis = async () => {
    if (!reportText.trim()) {
      setError('Add report text before AI analysis.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const analysis = await analyzeIncidentReport(reportText, {
        provider: 'gemini',
        context: { region: form.region, locationHint: form.location },
      });
      setAiAnalysis(analysis);
      if (!form.category.trim() || form.category === 'Other') {
        set('category', analysis?.classification?.category || form.category);
      }
      if (analysis?.extraction?.location && !form.location.trim()) {
        set('location', analysis.extraction.location);
      }
      if (analysis?.extraction?.urgencyLevel) {
        set('priority', urgencyToPriority(analysis.extraction.urgencyLevel));
      }
      if (analysis?.classification?.severityScore) {
        setUrgencyScore(Number(analysis.classification.severityScore) * 10);
      }
    } catch (e) {
      setError(e?.message || 'AI analysis failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const inp = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${DK.border}`,
    borderRadius: 10,
    fontSize: 13,
    color: DK.text,
    outline: 'none',
    background: '#0f172a',
    boxSizing: 'border-box',
  };
  const lbl = {
    fontSize: 10,
    fontWeight: 700,
    color: DK.muted,
    display: 'block',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.72)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: isMobile ? '100%' : 'min(560px, 100%)',
          maxHeight: isMobile ? '100vh' : '96vh',
          height: isMobile ? '100vh' : 'auto',
          overflowY: 'auto',
          background: `linear-gradient(165deg, ${DK.card} 0%, #172554 100%)`,
          borderRadius: isMobile ? 0 : 16,
          border: isMobile ? 'none' : `1px solid ${DK.border}`,
          boxShadow: isMobile ? 'none' : '0 24px 80px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            padding: '18px 22px 14px',
            borderBottom: `1px solid ${DK.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: DK.accent,
              }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: DK.text }}>Create New Task</div>
              <div style={{ fontSize: 12, color: DK.muted, marginTop: 2 }}>
                Choose a known place or drop a pin — coordinates save with the task
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(15,23,42,0.6)',
              border: `1px solid ${DK.border}`,
              borderRadius: 10,
              width: 40,
              height: 40,
              color: DK.muted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '18px 22px 10px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Category (e.g. Water Relief) *</label>
            <input
              style={inp}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="What support is needed?"
            />
          </div>

          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <label style={{...lbl,marginBottom:0}}>Report text</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={runAiAnalysis}
                  disabled={aiLoading || !reportText.trim()}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: `1px solid ${DK.accent}`,
                    background: aiLoading ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.15)',
                    color: DK.accent,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: aiLoading ? 'wait' : 'pointer',
                  }}
                >
                  {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
                </button>
                <VoiceInputButton
                  onTranscript={(text) => {
                    setReportText(text);
                    applyReportAnalysis(text);
                  }}
                />
              </div>
            </div>
            <textarea
              style={{ ...inp, minHeight: 88, resize: 'vertical' }}
              value={reportText}
              onChange={(e) => {
                setReportText(e.target.value);
                applyReportAnalysis(e.target.value);
              }}
              placeholder="Describe incident details..."
            />
            <div style={{marginTop:8,fontSize:11,color:DK.muted}}>
              AI urgency score: <strong style={{color: urgencyScore > 75 ? '#f87171' : urgencyScore >= 40 ? '#facc15' : '#4ade80'}}>{urgencyScore}</strong>
            </div>
            {aiAnalysis && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(56,189,248,0.25)',
                  background: 'rgba(15,23,42,0.45)',
                  fontSize: 11.5,
                  color: DK.text,
                  lineHeight: 1.55,
                }}
              >
                <div>
                  <strong>AI tags:</strong> {(aiAnalysis.tags || []).join(', ') || 'none'}
                </div>
                <div>
                  <strong>Extracted resource:</strong> {aiAnalysis?.extraction?.resourceNeeded || 'general support'}
                </div>
                <div>
                  <strong>Risk score:</strong> {aiAnalysis?.riskScore || 1}/10
                </div>
                <div>
                  <strong>Summary:</strong> {aiAnalysis?.summary || 'No summary available'}
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Location</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setLocTab('suggest')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${locTab === 'suggest' ? DK.accent : DK.border}`,
                  background: locTab === 'suggest' ? 'rgba(56,189,248,0.12)' : 'transparent',
                  color: locTab === 'suggest' ? DK.accent : DK.muted,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                <List size={15} /> Suggestions
              </button>
              <button
                type="button"
                onClick={() => setLocTab('map')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${locTab === 'map' ? DK.accent2 : DK.border}`,
                  background: locTab === 'map' ? 'rgba(167,139,250,0.12)' : 'transparent',
                  color: locTab === 'map' ? DK.accent2 : DK.muted,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                <Crosshair size={15} /> Map pin
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Location specifics *</label>
                <input
                  style={inp}
                  list="nl-place-suggestions"
                  value={form.location}
                  onChange={(e) => {
                    set('location', e.target.value);
                    const v = e.target.value.trim();
                    const hit = suggestions.find((p) => p.location.toLowerCase() === v.toLowerCase());
                    if (hit) {
                      setLat(hit.lat);
                      setLng(hit.lng);
                    }
                  }}
                  placeholder={locTab === 'map' ? 'e.g. Near river bridge' : 'Type or pick from list'}
                />
                <datalist id="nl-place-suggestions">
                  {suggestions.map((p) => (
                    <option key={p.location} value={p.location} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={lbl}>Region / district</label>
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  value={form.region}
                  onChange={(e) => onRegionChange(e.target.value)}
                >
                  {REGION_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {locTab === 'suggest' && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map((p) => (
                  <button
                    key={p.location}
                    type="button"
                    onClick={() => applyPlace(p)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: 999,
                      border: `1px solid ${DK.border}`,
                      background:
                        form.location === p.location ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.5)',
                      color: form.location === p.location ? DK.accent : DK.muted,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {p.location}
                  </button>
                ))}
              </div>
            )}

            {locTab === 'map' && (
              <div style={{ marginTop: 12 }}>
                <MapLocationPicker
                  region={form.region}
                  lat={lat}
                  lng={lng}
                  onPick={(la, ln) => {
                    setLat(la);
                    setLng(ln);
                    setError('');
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: 11.5, color: DK.muted, lineHeight: 1.5 }}>
              {lat != null && lng != null ? (
                <>
                  <span style={{ color: DK.accent }}>●</span> Exact coordinates attached (
                  {lat.toFixed(4)}, {lng.toFixed(4)}). Map will match this pin.
                </>
              ) : (
                <>
                  No pin / no list match — coordinates will fall back to the{' '}
                  <strong style={{ color: DK.text }}>{form.region}</strong> region center until you pick a
                  suggestion or map pin.
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Priority</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="urgent">Urgent</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Vols needed</label>
              <input
                type="number"
                min={1}
                style={inp}
                value={form.volunteers}
                onChange={(e) => set('volunteers', e.target.value)}
              />
            </div>
            <div>
              <label style={lbl}>Deadline</label>
              <input type="date" style={inp} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: DK.danger,
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.25)',
                padding: 10,
                borderRadius: 10,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 22px 18px',
            borderTop: `1px solid ${DK.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: `1px solid ${DK.border}`,
              background: 'transparent',
              color: DK.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.75 : 1,
              color: '#fff',
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
            }}
          >
            {saving ? 'Saving…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
