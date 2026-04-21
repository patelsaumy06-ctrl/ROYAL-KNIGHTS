import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api';
import { backendApi } from '../services/backendApi';
import { getAllIncidents, updateNeedStatus } from '../services/firestoreRealtime';
import { REGION_CENTERS, resolveNeedCoordinates, nearestRegion } from '../data/gujaratPlaces';
import { analyzeReport } from '../utils/reliefIntel';
import { rankVolunteersForTask, analyzeCrisisData, autoRespond } from '../core';
import {
  MapPin, Clock, Users, AlertTriangle, ArrowRight, Locate, Layers,
  Crosshair, ListTodo, X, ChevronRight, Activity, Shield, Zap,
  Radio, CheckCircle2, UserPlus, Eye, Flame, Sparkles, Filter,
  ChevronDown, PanelRightClose, PanelRightOpen, Globe2, Signal,
  MessageCircle, Brain
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Dark M3-inspired crisis response palette
   ════════════════════════════════════════════════════════════════════ */
const DK = {
  bg: '#0B0F1A',
  surface: '#111827',
  surfaceElevated: '#1A2234',
  surfaceHover: '#1E293B',
  glass: 'rgba(17, 24, 39, 0.75)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassHover: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(56,189,248,0.3)',
  t1: '#F1F5F9',
  t2: '#94A3B8',
  t3: '#64748B',
  t4: '#475569',
  red: '#EF4444',
  redGlow: 'rgba(239,68,68,0.25)',
  orange: '#F59E0B',
  orangeGlow: 'rgba(245,158,11,0.2)',
  green: '#10B981',
  greenGlow: 'rgba(16,185,129,0.2)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.2)',
  indigo: '#6366F1',
  cyan: '#06B6D4',
  violet: '#8B5CF6',
  shadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
  shadowLg: '0 20px 60px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)',
};

const PCOLOR = { urgent: DK.red, medium: DK.orange, low: DK.green };
const PGLOW = { urgent: DK.redGlow, medium: DK.orangeGlow, low: DK.greenGlow };

/* ════════════════════════════════════════════════════════════════════
   CUSTOM MARKER ICONS
   ════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   CUSTOM MARKER ICONS — High-fidelity Teardrop Pins
   ════════════════════════════════════════════════════════════════════ */
function createIcon(priority, isSelected, urgencyScore = 50) {
  const priorityColor =
    priority === 'urgent' ? DK.red : priority === 'medium' ? '#FACC15' : DK.green;
  const scoreColor = urgencyScore > 75 ? DK.red : urgencyScore >= 40 ? '#FACC15' : DK.green;
  const color = priorityColor || scoreColor;
  const size = isSelected ? 48 : 38;
  const iconSize = isSelected ? 20 : 16;
  const glow = isSelected ? `0 0 20px ${color}88` : `0 4px 12px ${color}44`;

  return L.divIcon({
    className: 'nmap-marker-pin',
    html: `
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;position:relative;filter:drop-shadow(${glow});transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);${isSelected ? 'transform:translateY(-8px) scale(1.1);' : ''}">
        ${priority === 'urgent' ? `
          <div style="position:absolute;width:${size + 24}px;height:${size + 24}px;border-radius:50%;border:2px solid ${color};animation:nmap-pulse 2s ease-out infinite;top:-12px;left:-12px;"></div>
        ` : ''}
        <svg width="${size}" height="${size * 1.2}" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 0C8.506 0 0 8.506 0 19C0 32.111 16.583 44.825 18.258 46.069C18.472 46.227 18.732 46.312 19 46.312C19.268 46.312 19.528 46.227 19.742 46.069C21.417 44.825 38 32.111 38 19C38 8.506 29.494 0 19 0Z" fill="${color}"/>
          <circle cx="19" cy="19" r="13" fill="white" fill-opacity="0.2"/>
          <circle cx="19" cy="19" r="10" fill="white"/>
        </svg>
        <div style="position:absolute;top:10px;display:flex;align-items:center;justify-content:center;color:${color};">
          ${priority === 'urgent' ? 
            `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>` : 
            `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`}
        </div>
      </div>
    `,
    iconSize: [size, size * 1.2],
    iconAnchor: [size / 2, size * 1.2],
    popupAnchor: [0, -size * 1.2],
  });
}

function createVolIcon(available, isSelected) {
  const color = available ? DK.indigo : DK.t3;
  const size = isSelected ? 44 : 34;
  const glow = isSelected ? `0 0 15px ${color}88` : `0 2px 8px ${color}33`;

  return L.divIcon({
    className: 'nmap-vol-pin',
    html: `
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;position:relative;filter:drop-shadow(${glow});transition:all 0.3s ease;${isSelected ? 'transform:translateY(-4px);' : ''}">
        <svg width="${size}" height="${size * 1.2}" viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 0C8.506 0 0 8.506 0 19C0 32.111 16.583 44.825 18.258 46.069C18.472 46.227 18.732 46.312 19 46.312C19.268 46.312 19.528 46.227 19.742 46.069C21.417 44.825 38 32.111 38 19C38 8.506 29.494 0 19 0Z" fill="${color}"/>
          <circle cx="19" cy="19" r="12" fill="white" fill-opacity="0.2"/>
        </svg>
        <div style="position:absolute;top:8px;color:white;">
          <svg width="${size - 18}" height="${size - 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
      </div>
    `,
    iconSize: [size, size * 1.2],
    iconAnchor: [size / 2, size * 1.2],
    popupAnchor: [0, -size * 1.2],
  });
}



/* ════════════════════════════════════════════════════════════════════
   MAP HELPER COMPONENTS
   ════════════════════════════════════════════════════════════════════ */
function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

function FitNeedsBounds({ pins, revision }) {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (!pins.length || didFit.current) return;
    didFit.current = true;
    try {
      const b = L.latLngBounds(pins.map(p => [p.lat, p.lng]));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 11, animate: true });
    } catch { /* ignore */ }
  }, [map, pins, revision]);
  return null;
}

function MapClickCreateTask({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/* Heatmap overlay using canvas */
function HeatmapLayer({ pins, visible }) {
  const map = useMap();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible || !pins.length) {
      if (canvasRef.current) { map.removeLayer(canvasRef.current); canvasRef.current = null; }
      return;
    }
    const heat = L.canvas({ padding: 0.5 });
    pins.forEach(p => {
      const radius = p.priority === 'urgent' ? 45 : p.priority === 'medium' ? 30 : 20;
      const color = PCOLOR[p.priority];
      L.circleMarker([p.lat, p.lng], {
        renderer: heat, radius, fillColor: color,
        fillOpacity: 0.15, stroke: false,
      }).addTo(map);
    });
    canvasRef.current = heat;
    return () => { if (canvasRef.current) map.removeLayer(canvasRef.current); };
  }, [map, pins, visible]);
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   SKELETON LOADING COMPONENT
   ════════════════════════════════════════════════════════════════════ */
function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%', animation: 'nmap-shimmer 1.5s ease infinite',
      ...style
    }} />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton height={42} radius={12} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton width="33%" height={80} radius={14} />
        <Skeleton width="33%" height={80} radius={14} />
        <Skeleton width="33%" height={80} radius={14} />
      </div>
      <Skeleton height={400} radius={20} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EMPTY STATE ILLUSTRATION
   ════════════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      style={{ textAlign: 'center', padding: '40px 24px' }}
    >
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 20px' }}>
        {/* Pin illustration */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 60, height: 60, borderRadius: '50% 50% 50% 0',
            background: `linear-gradient(135deg, ${DK.blue}, ${DK.indigo})`,
            transform: 'rotate(-45deg)',
            position: 'absolute', left: 30, top: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 16px 40px ${DK.blueGlow}`,
          }}
        >
          <MapPin size={22} style={{ transform: 'rotate(45deg)', color: '#fff' }} />
        </motion.div>
        {/* Shadow */}
        <motion.div
          animate={{ scale: [1, 0.8, 1], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 60, height: 12, borderRadius: '50%',
            background: 'rgba(99,102,241,0.2)',
            position: 'absolute', bottom: 16, left: 30,
            filter: 'blur(4px)',
          }}
        />
        {/* Decorative rings */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `1px dashed ${DK.border}`,
        }} />
        <div style={{
          position: 'absolute', inset: -10, borderRadius: '50%',
          border: `1px dashed rgba(255,255,255,0.03)`,
        }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: DK.t1, marginBottom: 8, letterSpacing: '-0.02em' }}>
        Select a Location
      </div>
      <div style={{ fontSize: 13, color: DK.t3, lineHeight: 1.6, maxWidth: 220, margin: '0 auto' }}>
        Click any pin on the map to view details, assign volunteers, or take action
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MAIN MAPVIEW COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function MapView({ onNav, emergency, initialTask, riskScore = 0, needsOverride = null, ngoEmail = '' }) {
  const [needs, setNeeds] = useState(null);
  const [vols, setVols] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [mapCenter, setMapCenter] = useState([23.6, 72.3]);
  const [mapZoom, setMapZoom] = useState(9);
  const [showVolunteers, setShowVolunteers] = useState(false);
  const [pinCreateMode, setPinCreateMode] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [lastSync, setLastSync] = useState(Date.now());
  const [resolving, setResolving] = useState(false);
  const [smartMatches, setSmartMatches] = useState([]);
  const [autoResponse, setAutoResponse] = useState({ assignments: [], summary: { totalIncidentsHandled: 0, totalVolunteersAssigned: 0, resourcesUsed: {} } });
  const [autoRespondLoading, setAutoRespondLoading] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [matchExplanations, setMatchExplanations] = useState({});
  const [explainLoading, setExplainLoading] = useState(new Set());
  const needsRevision = needs?.length ?? 0;

  useEffect(() => {
    if (Array.isArray(needsOverride) && needsOverride.length > 0) {
      setNeeds(needsOverride);
      setLastSync(Date.now());
      return;
    }
    const email = ngoEmail || localStorage.getItem('ReliefLink_current_ngo_email');
    if (!email) {
      setNeeds([]);
      return;
    }
    getAllIncidents(email)
      .then((items) => {
        setNeeds(items);
        setLastSync(Date.now());
        setLoadError('');
      })
      .catch((error) => {
        console.error(error);
        setLoadError(error?.message || 'Failed to load incidents.');
        setNeeds([]);
      });
  }, [needsOverride, ngoEmail]);

  useEffect(() => {
    api.getVolunteers().then(setVols);
  }, []);

  const PINS = useMemo(
    () =>
      (needs || []).map(n => {
        const { lat, lng } =
          n.lat != null && n.lng != null
            ? { lat: n.lat, lng: n.lng }
            : resolveNeedCoordinates(n);
        const reportSignal = analyzeReport(`${n.category || ''} ${n.reportText || ''}`);
        return {
          id: n.id, lat, lng, label: n.location, priority: n.priority,
          region: n.region, issue: n.category, assigned: n.assigned,
          volunteers: n.volunteers, status: n.status, deadline: n.deadline,
          urgencyScore: n.urgencyScore ?? reportSignal.score,
        };
      }),
    [needs]
  );

  const filteredPins = useMemo(
    () => filter === 'all' ? PINS : PINS.filter(p => p.priority === filter),
    [PINS, filter]
  );

  const stats = useMemo(() => ({
    total: PINS.length,
    urgent: PINS.filter(p => p.priority === 'urgent').length,
    medium: PINS.filter(p => p.priority === 'medium').length,
    low: PINS.filter(p => p.priority === 'low').length,
    activeVols: vols.filter(v => v.available).length,
    totalVols: vols.length,
  }), [PINS, vols]);

  const crisisData = useMemo(() => {
    const incidents = PINS.map((pin) => ({
      id: pin.id,
      type: pin.issue,
      severity: pin.priority === 'urgent' ? 'critical' : pin.priority,
      location: { lat: pin.lat, lng: pin.lng, label: pin.label },
    }));
    const volunteers = vols.map((vol) => ({
      ...vol,
      location: { lat: vol.lat, lng: vol.lng, label: vol.region },
      skills: vol.skills || [vol.skill].filter(Boolean),
    }));
    const resources = [
      { type: 'medical kits', quantity: Math.max(2, Math.round(vols.length / 4)), availability: true },
      { type: 'vehicles', quantity: Math.max(1, Math.round(vols.filter((v) => v.available).length / 6)), availability: true },
      { type: 'ambulance', quantity: Math.max(1, Math.round(vols.length / 10)), availability: true },
    ];
    return { incidents, volunteers, resources };
  }, [PINS, vols]);

  const decisionOutput = useMemo(() => {
    return analyzeCrisisData(crisisData);
  }, [crisisData]);

  const decisionById = useMemo(
    () => Object.fromEntries((decisionOutput.decisions || []).map((item) => [String(item.incidentId), item])),
    [decisionOutput]
  );

  const assignmentById = useMemo(
    () => Object.fromEntries((autoResponse.assignments || []).map((item) => [String(item.incidentId), item])),
    [autoResponse]
  );

  const assignedIncidentIds = useMemo(
    () => new Set((autoResponse.assignments || []).map((item) => String(item.incidentId))),
    [autoResponse]
  );

  useEffect(() => {
    if (!needs?.length || initialTask == null || initialTask === '') return;
    const id = typeof initialTask === 'object' ? initialTask.needId ?? initialTask.id : initialTask;
    if (id == null || id === '') return;
    const n = needs.find((x) => String(x.id) === String(id));
    if (!n) return;
    const c = n.lat != null && n.lng != null ? { lat: n.lat, lng: n.lng } : resolveNeedCoordinates(n);
    setSelected(n.id);
    setMapCenter([c.lat, c.lng]);
    setMapZoom(12);
  }, [needs, initialTask]);

  if (!needs) return <LoadingSkeleton />;

  const sel = PINS.find(p => p.id === selected);

  const handlePinClick = (pin) => {
    setSelected(s => s === pin.id ? null : pin.id);
    setMapCenter([pin.lat, pin.lng]);
    setMapZoom(12);
    if (!sidebarOpen) setSidebarOpen(true);
  };

  const resetView = () => {
    const d = REGION_CENTERS.Mehsana;
    setMapCenter([d.lat, d.lng]);
    setMapZoom(9);
    setSelected(null);
    setPinCreateMode(false);
    setFilter('all');
  };

  const handleMapPinCreate = (la, ln) => {
    setPinCreateMode(false);
    const region = nearestRegion(la, ln);
    onNav('tasks', { openModal: true, lat: la, lng: ln, region, location: `Map pin (${la.toFixed(4)}°N, ${ln.toFixed(4)}°E)` });
  };

  const handleResolve = async () => {
    if (!sel || resolving) return;
    setResolving(true);
    try {
      const email = ngoEmail || localStorage.getItem('ReliefLink_current_ngo_email');
      if (!email) throw new Error('Missing logged-in NGO email.');
      await updateNeedStatus(email, sel.id, 'resolved');
      setSelected(null);
      setLoadError('');
      setLastSync(Date.now());
    } catch (error) {
      setLoadError(error?.message || 'Failed to resolve incident.');
    } finally {
      setResolving(false);
    }
  };

  const runSmartAssign = () => {
    if (!sel) return;
    const need = needs.find((n) => n.id === sel.id);
    if (!need) return;
    const ranked = rankVolunteersForTask(need, vols).slice(0, 3);
    setSmartMatches(ranked);
    setMatchExplanations({});
  };

  const handleExplainMatch = async (volunteer) => {
    if (!sel || explainLoading.has(volunteer.id)) return;
    setExplainLoading(prev => new Set([...prev, volunteer.id]));
    try {
      const need = needs.find((n) => n.id === sel.id);
      const taskPayload = {
        id: need?.id || sel.id,
        title: sel.issue,
        category: sel.issue,
        location: sel.label,
        region: sel.region,
        priority: sel.priority,
        affectedPeople: need?.affectedPeople,
        requiredSkills: need?.requiredSkills || [sel.issue],
      };
      const result = await backendApi.explainMatch(volunteer, taskPayload);
      setMatchExplanations(prev => ({ ...prev, [volunteer.id]: result.explanation }));
    } catch (err) {
      setMatchExplanations(prev => ({
        ...prev,
        [volunteer.id]: `Could not generate explanation: ${err.message}`,
      }));
    } finally {
      setExplainLoading(prev => {
        const next = new Set(prev);
        next.delete(volunteer.id);
        return next;
      });
    }
  };

  const handleAutoRespond = async () => {
    if (autoRespondLoading) return;
    setAutoRespondLoading(true);
    try {
      const result = autoRespond(crisisData);
      setAutoResponse(result);
      setSuccessToast('AI successfully coordinated response');
      setTimeout(() => setSuccessToast(''), 2600);
    } catch (error) {
      setLoadError(error?.message || 'Auto Respond failed.');
    } finally {
      setAutoRespondLoading(false);
    }
  };

  const getTimeSince = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'Just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  const getAISuggestion = (pin) => {
    const decision = decisionById[String(pin.id)];
    if (decision?.priority === 'high') return { label: 'Escalate Command', color: DK.red };
    if (decision?.priority === 'medium') return { label: 'Deploy Nearby Team', color: DK.orange };
    if (pin.priority === 'urgent' && pin.assigned === 0) return { label: 'Immediate Deploy', color: DK.red };
    if (pin.priority === 'urgent') return { label: 'High Priority', color: DK.orange };
    if (pin.assigned < pin.volunteers * 0.5) return { label: 'Needs Attention', color: DK.orange };
    if (pin.status === 'resolved') return { label: 'Resolved', color: DK.green };
    return { label: 'On Track', color: DK.green };
  };

  const filterChips = [
    { key: 'all', label: 'All', count: stats.total, color: DK.blue },
    { key: 'urgent', label: 'Critical', count: stats.urgent, color: DK.red },
    { key: 'medium', label: 'Medium', count: stats.medium, color: DK.orange },
    { key: 'low', label: 'Low', count: stats.low, color: DK.green },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: DK.bg, color: DK.t1, overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* ═══ GLOBAL STYLES ═══ */}
      <style>{`
        @keyframes nmap-pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes nmap-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes nmap-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes nmap-live {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(16,185,129,0.1); }
        }
        @keyframes nmap-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes nmap-ripple {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(4); opacity: 0; }
        }
        @keyframes nmap-critical-bar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes nmap-pin-drop {
          0% { transform: translateY(-30px) scale(0.8); opacity: 0; }
          60% { transform: translateY(4px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .nmap-marker { background: none !important; border: none !important; animation: nmap-pin-drop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .nmap-cluster { background: none !important; border: none !important; }
        .nmap-btn {
          border: none; background: none; cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative; overflow: hidden;
        }
        .nmap-btn::after {
          content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.1);
          border-radius: inherit; transform: scale(0); opacity: 0;
          transition: all 0.4s ease;
        }
        .nmap-btn:active::after { transform: scale(4); opacity: 0; transition: 0s; }
        .leaflet-popup-content-wrapper {
          background: rgba(11,15,26,0.95) !important;
          backdrop-filter: blur(20px) saturate(180%) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1) !important;
          color: #fff !important; padding: 0 !important;
        }
        .leaflet-popup-tip { background: rgba(11,15,26,0.95) !important; }
        .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; font-size: 20px !important; top: 10px !important; right: 12px !important; }
        .leaflet-popup-close-button:hover { color: rgba(255,255,255,0.8) !important; }
        .leaflet-control-zoom a {
          background: rgba(11,15,26,0.85) !important; color: #fff !important;
          border-color: rgba(255,255,255,0.08) !important;
          backdrop-filter: blur(12px) !important;
          transition: all 0.2s !important;
        }
        .leaflet-control-zoom a:hover { background: rgba(59,130,246,0.4) !important; border-color: rgba(59,130,246,0.3) !important; }
        .leaflet-control-attribution { display: none; }

        /* Scrollbar for sidebar */
        .nmap-scroll::-webkit-scrollbar { width: 4px; }
        .nmap-scroll::-webkit-scrollbar-track { background: transparent; }
        .nmap-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 100px; }
        .nmap-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {/* ═══ TOP SUMMARY BAR ═══ */}
      {successToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            background: 'rgba(16,185,129,0.94)',
            color: '#ecfdf5',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: DK.shadow,
          }}
        >
          {successToast}
        </motion.div>
      )}
      {loadError && (
        <div style={{ margin: '8px 20px 0', padding: '8px 12px', borderRadius: 10, background: '#7f1d1d', border: '1px solid #b91c1c', color: '#fee2e2', fontSize: 12 }}>
          {loadError}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        borderBottom: `1px solid ${DK.border}`,
        background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(11,15,26,0.98))',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        {/* Title cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${DK.blue}, ${DK.indigo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${DK.blueGlow}`,
          }}>
            <Globe2 size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: DK.t1, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Needs Map
            </div>
            <div style={{ fontSize: 10.5, color: DK.t3, fontWeight: 500 }}>
              Live Geo Intelligence
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Total emergencies */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: DK.surfaceElevated, borderRadius: 10,
            padding: '8px 14px', border: `1px solid ${DK.border}`,
          }}>
            <Activity size={14} color={DK.blue} />
            <div>
              <div style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Emergencies</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: DK.t1, lineHeight: 1.2 }}>{stats.total}</div>
            </div>
          </div>

          {/* Active volunteers */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: DK.surfaceElevated, borderRadius: 10,
            padding: '8px 14px', border: `1px solid ${DK.border}`,
          }}>
            <Users size={14} color={DK.green} />
            <div>
              <div style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Volunteers</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: DK.t1, lineHeight: 1.2 }}>
                {stats.activeVols}<span style={{ fontSize: 11, color: DK.t3, fontWeight: 500 }}>/{stats.totalVols}</span>
              </div>
            </div>
          </div>

          {/* Critical alerts — pulsing */}
          <motion.div
            animate={stats.urgent > 0 ? { boxShadow: [`0 0 0 0px ${DK.redGlow}`, `0 0 0 4px ${DK.redGlow}`, `0 0 0 0px ${DK.redGlow}`] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: stats.urgent > 0 ? 'rgba(239,68,68,0.08)' : DK.surfaceElevated,
              borderRadius: 10, padding: '8px 14px',
              border: `1px solid ${stats.urgent > 0 ? 'rgba(239,68,68,0.2)' : DK.border}`,
            }}
          >
            <motion.div
              animate={stats.urgent > 0 ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AlertTriangle size={14} color={DK.red} />
            </motion.div>
            <div>
              <div style={{ fontSize: 10, color: stats.urgent > 0 ? '#FCA5A5' : DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1 }}>Critical</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: stats.urgent > 0 ? DK.red : DK.t1, lineHeight: 1.2 }}>{stats.urgent}</div>
            </div>
          </motion.div>
        </div>

        {/* Live sync indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.08)', borderRadius: 100,
          padding: '6px 12px', border: '1px solid rgba(16,185,129,0.15)',
          animation: 'nmap-live 2s ease infinite',
        }}>
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: DK.green }}
          />
          <span style={{ fontSize: 11, fontWeight: 600, color: DK.green }}>{getTimeSince(lastSync)}</span>
        </div>

        {/* Sidebar toggle */}
        <button
          className="nmap-btn"
          onClick={() => setSidebarOpen(v => !v)}
          style={{
            padding: 8, borderRadius: 8,
            background: DK.surfaceElevated, border: `1px solid ${DK.border}`,
            color: DK.t2, display: 'flex', alignItems: 'center',
          }}
        >
          {sidebarOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ═══ MAP AREA — FULL WIDTH ═══ */}
        <div style={{ flex: 1, position: 'relative' }}>

          {/* Emergency Mode Banner */}
          {emergency && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: 12, left: 12, right: sidebarOpen ? 392 : 12, zIndex: 1000,
                background: 'linear-gradient(135deg, rgba(127,29,29,0.92), rgba(153,27,27,0.92))',
                backdropFilter: 'blur(16px)',
                borderRadius: 14, padding: '12px 18px',
                border: '1px solid rgba(248,113,113,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                animation: 'nmap-critical-bar 2s ease infinite',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <motion.div
                  animate={{ opacity: [1, 0.3, 1], scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#F87171' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>
                  🚨 EMERGENCY MODE — {stats.urgent} critical zones highlighted
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>All urgent pins pulsing</span>
            </motion.div>
          )}

          {/* Filter chips — floating above map */}
          <div style={{
            position: 'absolute', top: emergency ? 64 : 12, left: 12, zIndex: 1000,
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {filterChips.map(chip => {
              const isActive = filter === chip.key;
              return (
                <motion.button
                  key={chip.key}
                  className="nmap-btn"
                  whileHover={{ scale: 1.04, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setFilter(chip.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 100,
                    background: isActive ? `${chip.color}22` : 'rgba(11,15,26,0.8)',
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${isActive ? `${chip.color}44` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? chip.color : DK.t2,
                    fontSize: 12, fontWeight: 600,
                    boxShadow: isActive ? `0 4px 16px ${chip.color}22` : 'none',
                  }}
                >
                  {chip.key !== 'all' && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: chip.color,
                      boxShadow: `0 0 6px ${chip.color}55`,
                    }} />
                  )}
                  {chip.label}
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    background: isActive ? `${chip.color}33` : 'rgba(255,255,255,0.06)',
                    padding: '2px 7px', borderRadius: 100,
                    color: isActive ? chip.color : DK.t3,
                  }}>
                    {chip.count}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Map toolbar — top right */}
          <div style={{
            position: 'absolute', top: 12, right: sidebarOpen ? 392 : 12, zIndex: 1000,
            display: 'flex', gap: 6,
          }}>
            {/* Heatmap toggle */}
            <motion.button
              className="nmap-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHeatmap(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: showHeatmap ? 'rgba(245,158,11,0.15)' : 'rgba(11,15,26,0.8)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${showHeatmap ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: showHeatmap ? DK.orange : DK.t2,
                fontSize: 12, fontWeight: 600,
              }}
            >
              <Flame size={14} />
              Heatmap
            </motion.button>

            {/* Volunteers toggle */}
            <motion.button
              className="nmap-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVolunteers(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: showVolunteers ? 'rgba(99,102,241,0.15)' : 'rgba(11,15,26,0.8)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${showVolunteers ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: showVolunteers ? DK.indigo : DK.t2,
                fontSize: 12, fontWeight: 600,
              }}
            >
              <Users size={14} />
              Volunteers
            </motion.button>

            {/* Reset */}
            <motion.button
              className="nmap-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAutoRespond}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.18)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(239,68,68,0.35)',
                color: '#FCA5A5',
                fontSize: 12, fontWeight: 700,
                opacity: autoRespondLoading ? 0.7 : 1,
              }}
            >
              <Sparkles size={14} />
              {autoRespondLoading ? 'Coordinating...' : '🚨 Auto Respond'}
            </motion.button>

            <motion.button
              className="nmap-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={runSmartAssign}
              disabled={!sel}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10,
                background: sel ? 'rgba(99,102,241,0.18)' : 'rgba(11,15,26,0.5)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${sel ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: sel ? DK.indigo : DK.t3,
                fontSize: 12, fontWeight: 700,
                opacity: sel ? 1 : 0.6,
              }}
            >
              <Zap size={14} />
              Smart Assign
            </motion.button>

            <motion.button
              className="nmap-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetView}
              style={{
                padding: 8, borderRadius: 10,
                background: 'rgba(11,15,26,0.8)', backdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.08)`,
                color: DK.t2, display: 'flex', alignItems: 'center',
              }}
            >
              <Locate size={16} />
            </motion.button>
          </div>

          {/* Pin create mode banner */}
          {pinCreateMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: emergency ? 112 : 56, left: 12, right: sidebarOpen ? 392 : 12,
                zIndex: 1000,
                background: 'rgba(6,182,212,0.9)', backdropFilter: 'blur(16px)',
                color: '#042f2e', fontSize: 13, fontWeight: 700,
                padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.25)',
                pointerEvents: 'none',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Crosshair size={16} />
              Click the map to open <strong>Create Task</strong> with this GPS
            </motion.div>
          )}

          {/* Stats badges — bottom left */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 6, zIndex: 1000 }}>
            {[['urgent', 'Critical', stats.urgent], ['medium', 'Medium', stats.medium], ['low', 'Low', stats.low]].map(([p, l, c]) => (
              <div key={p} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(11,15,26,0.85)', backdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 10, padding: '6px 12px',
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: PCOLOR[p], boxShadow: `0 0 8px ${PCOLOR[p]}66`,
                }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  {c} {l}
                </span>
              </div>
            ))}
            {showVolunteers && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(11,15,26,0.85)', backdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 10, padding: '6px 12px',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: DK.indigo, boxShadow: `0 0 8px rgba(99,102,241,0.5)` }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{stats.activeVols} Active</span>
              </div>
            )}
          </div>

          {/* Selected coords badge — bottom right */}
          {sel && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', bottom: 16, right: sidebarOpen ? 392 : 120, zIndex: 1000,
                background: 'rgba(11,15,26,0.85)', backdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 10, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Signal size={13} color="rgba(255,255,255,0.4)" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}>
                {sel.lat.toFixed(4)}°N, {sel.lng.toFixed(4)}°E
              </span>
            </motion.div>
          )}

          {/* ═══ THE MAP ═══ */}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: '100%', height: '100%', zIndex: 1, cursor: pinCreateMode ? 'crosshair' : 'grab' }}
            zoomControl
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
            <FitNeedsBounds pins={PINS} revision={needsRevision} />
            <MapRecenter center={mapCenter} zoom={mapZoom} />
            <MapClickCreateTask active={pinCreateMode} onPick={handleMapPinCreate} />

            {/* Heatmap */}
            {(autoResponse.assignments || [])
              .filter((assignment) => assignment.assignedVolunteers?.length || assignment.allocatedResources?.length)
              .map((assignment) => {
                const pin = PINS.find((item) => String(item.id) === String(assignment.incidentId));
                if (!pin) return null;
                return (
                  <CircleMarker
                    key={`assigned-${assignment.incidentId}`}
                    center={[pin.lat, pin.lng]}
                    radius={16}
                    pathOptions={{
                      color: '#22D3EE',
                      fillColor: '#22D3EE',
                      fillOpacity: 0.15,
                      weight: 2,
                    }}
                  />
                );
              })}

            {showHeatmap && filteredPins.map(p => (
              <CircleMarker
                key={`heat-${p.id}`}
                center={[p.lat, p.lng]}
                radius={p.priority === 'urgent' ? 50 : p.priority === 'medium' ? 35 : 25}
                pathOptions={{
                  fillColor: PCOLOR[p.priority],
                  fillOpacity: 0.12, stroke: false,
                }}
              />
            ))}

            {/* Need Pins - Direct rendering without clustering */}
            {filteredPins.map(p => (
              <Marker
                key={p.id}
                position={[p.lat, p.lng]}
                icon={createIcon(p.priority, selected === p.id, p.urgencyScore)}
                priority={p.priority}
                eventHandlers={{ click: () => handlePinClick(p) }}
              >
                <Popup>
                  <div style={{ padding: '16px 18px', minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: PCOLOR[p.priority],
                        boxShadow: `0 0 10px ${PCOLOR[p.priority]}`,
                      }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>{p.label}</span>
                      {/* AI badge */}
                      {(() => {
                        const ai = getAISuggestion(p);
                        return (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '3px 8px',
                            borderRadius: 100, background: `${ai.color}18`,
                            color: ai.color, border: `1px solid ${ai.color}30`,
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <Sparkles size={9} /> {ai.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{p.issue}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>{p.region} District, Gujarat</div>
                    {decisionById[String(p.id)]?.suggestedAction && (
                      <div style={{ fontSize: 11, color: '#93C5FD', marginBottom: 10 }}>
                        AI Action: {decisionById[String(p.id)].suggestedAction}
                      </div>
                    )}
                    {assignmentById[String(p.id)] && (
                      <div style={{ fontSize: 11, color: '#A7F3D0', marginBottom: 10, lineHeight: 1.5 }}>
                        Assignment: {(assignmentById[String(p.id)].assignedVolunteers || []).map((v) => v.name).join(', ') || 'No volunteers available'}
                        <br />
                        ETA: {assignmentById[String(p.id)].etaEstimate}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Volunteers</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: DK.blue }}>
                          {p.assigned}<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>/{p.volunteers}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Priority</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: PCOLOR[p.priority], textTransform: 'capitalize' }}>{p.priority}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Deadline</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{p.deadline}</div>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Volunteer Pins */}
            {showVolunteers && vols.map(v => (
              v.lat && v.lng && (
                <Marker
                  key={`vol-${v.id}`}
                  position={[v.lat, v.lng]}
                  icon={createVolIcon(v.available, false)} // Can add selection logic if needed
                >
                  <Popup>
                    <div style={{ padding: '14px 16px', minWidth: 180 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{v.skill}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                          background: v.available ? 'rgba(99,102,241,0.15)' : 'rgba(71,85,105,0.2)',
                          color: v.available ? DK.indigo : DK.t3,
                          border: `1px solid ${v.available ? 'rgba(99,102,241,0.25)' : 'rgba(71,85,105,0.2)'}`,
                        }}>
                          {v.available ? '● Available' : '○ Busy'}
                        </span>
                        <span style={{ fontSize: 11, color: DK.orange }}>{'★'.repeat(v.rating)}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>

        {/* ═══ COLLAPSIBLE SIDEBAR ═══ */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '100%', overflow: 'hidden', flexShrink: 0,
                borderLeft: `1px solid ${DK.border}`,
                background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(11,15,26,0.99))',
                backdropFilter: 'blur(20px)',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div className="nmap-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0' }}>

                {/* ═══ SELECTED DETAIL / EMPTY STATE ═══ */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selected || 'empty'}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {sel ? (
                      <div>
                        {/* Detail header */}
                        <div style={{
                          padding: '18px 20px 14px',
                          borderBottom: `1px solid ${DK.border}`,
                          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 12,
                              background: `${PCOLOR[sel.priority]}15`,
                              border: `1px solid ${PCOLOR[sel.priority]}25`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {sel.priority === 'urgent' ? <AlertTriangle size={18} color={PCOLOR[sel.priority]} /> : <MapPin size={18} color={PCOLOR[sel.priority]} />}
                            </div>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: DK.t1, letterSpacing: '-0.02em' }}>
                                {sel.label}
                              </div>
                              <div style={{ fontSize: 11.5, color: DK.t3, marginTop: 1 }}>
                                {sel.region} District
                              </div>
                            </div>
                          </div>
                          <button
                            className="nmap-btn"
                            onClick={() => setSelected(null)}
                            style={{ padding: 6, borderRadius: 8, color: DK.t3, background: DK.surfaceElevated, border: `1px solid ${DK.border}` }}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* AI Priority Badge */}
                        {(() => {
                          const ai = getAISuggestion(sel);
                          return (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              style={{
                                margin: '14px 20px 0',
                                padding: '10px 14px', borderRadius: 10,
                                background: `${ai.color}08`,
                                border: `1px solid ${ai.color}20`,
                                display: 'flex', alignItems: 'center', gap: 8,
                              }}
                            >
                              <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                background: `${ai.color}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Sparkles size={14} color={ai.color} />
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Suggested Priority</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: ai.color }}>{ai.label}</div>
                              </div>
                            </motion.div>
                          );
                        })()}

                        {/* Category title */}
                        <div style={{ padding: '16px 20px 0' }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: DK.t1, letterSpacing: '-0.03em', marginBottom: 4 }}>
                            {sel.issue}
                          </div>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                            background: `${PCOLOR[sel.priority]}15`,
                            color: PCOLOR[sel.priority],
                            border: `1px solid ${PCOLOR[sel.priority]}25`,
                            textTransform: 'capitalize',
                          }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: PCOLOR[sel.priority] }} />
                            {sel.priority} priority
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{
                            background: DK.surfaceElevated, borderRadius: 12, padding: '14px 16px',
                            border: `1px solid ${DK.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Users size={13} color={DK.blue} />
                              <span style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volunteers</span>
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: DK.t1 }}>
                              {sel.assigned}<span style={{ fontSize: 13, color: DK.t3, fontWeight: 500 }}>/{sel.volunteers}</span>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 4, marginTop: 8, overflow: 'hidden' }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${sel.volunteers > 0 ? (sel.assigned / sel.volunteers) * 100 : 0}%` }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                style={{ background: `linear-gradient(90deg, ${DK.blue}, ${DK.indigo})`, height: '100%', borderRadius: 100 }}
                              />
                            </div>
                          </div>

                          <div style={{
                            background: DK.surfaceElevated, borderRadius: 12, padding: '14px 16px',
                            border: `1px solid ${DK.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Clock size={13} color={sel.priority === 'urgent' ? DK.red : DK.orange} />
                              <span style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</span>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: sel.priority === 'urgent' ? DK.red : DK.t1 }}>
                              {sel.deadline}
                            </div>
                          </div>

                          <div style={{
                            background: DK.surfaceElevated, borderRadius: 12, padding: '14px 16px',
                            border: `1px solid ${DK.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Shield size={13} color={DK.cyan} />
                              <span style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                            </div>
                            <div style={{
                              fontSize: 13, fontWeight: 700,
                              color: sel.status === 'resolved' ? DK.green : sel.status === 'active' ? DK.blue : DK.orange,
                              textTransform: 'capitalize',
                            }}>
                              {sel.status}
                            </div>
                          </div>

                          <div style={{
                            background: DK.surfaceElevated, borderRadius: 12, padding: '14px 16px',
                            border: `1px solid ${DK.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Signal size={13} color={DK.violet} />
                              <span style={{ fontSize: 10, color: DK.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coords</span>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: DK.t2, fontFamily: "'JetBrains Mono', monospace" }}>
                              {sel.lat.toFixed(3)}°, {sel.lng.toFixed(3)}°
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ padding: '0 20px 16px' }}>
                          <div style={{ fontSize: 13, color: DK.t3, lineHeight: 1.7 }}>
                            Community need identified in {sel.label}. Requires coordinated volunteer deployment and resource allocation for {sel.issue.toLowerCase()}.
                          </div>
                        {decisionById[String(sel.id)] && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#93C5FD', lineHeight: 1.5 }}>
                            Suggested action: {decisionById[String(sel.id)].suggestedAction}
                            <br />
                            Predicted escalation: {Math.round((decisionById[String(sel.id)].predictions?.escalationProbability || 0) * 100)}%
                          </div>
                        )}
                        {assignmentById[String(sel.id)] && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#A7F3D0', lineHeight: 1.5 }}>
                            Assigned volunteers: {(assignmentById[String(sel.id)].assignedVolunteers || []).map((item) => item.name).join(', ') || 'No volunteers available'}
                            <br />
                            Allocated resources: {(assignmentById[String(sel.id)].allocatedResources || []).map((item) => `${item.quantity} ${item.type}`).join(', ') || 'No resources available'}
                            <br />
                            ETA estimate: {assignmentById[String(sel.id)].etaEstimate}
                          </div>
                        )}
                          <div style={{marginTop:8,fontSize:11,color:DK.t4}}>Risk score impact: {riskScore}/100</div>
                        </div>

                        {smartMatches.length > 0 && (
                          <div style={{padding:'0 20px 16px'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <Brain size={13} color={DK.cyan} />
                                <span style={{fontSize:11,fontWeight:700,color:DK.t3,textTransform:'uppercase',letterSpacing:'0.8px'}}>AI Smart Matches</span>
                              </div>
                              <span style={{
                                fontSize:9,fontWeight:700,padding:'3px 8px',borderRadius:100,
                                background:'rgba(6,182,212,0.1)',color:DK.cyan,
                                border:'1px solid rgba(6,182,212,0.2)',
                              }}>{smartMatches.length} found</span>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:8}}>
                              {smartMatches.map((m, idx) => {
                                const isExplaining = explainLoading.has(m.id);
                                const explanation = matchExplanations[m.id];
                                const scoreColor = m.assignmentScore >= 0.7 ? DK.green : m.assignmentScore >= 0.5 ? DK.orange : DK.red;
                                return (
                                  <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                                    style={{
                                      background: DK.surfaceElevated,
                                      border: `1px solid ${explanation ? 'rgba(6,182,212,0.2)' : DK.border}`,
                                      borderRadius: 12,
                                      overflow: 'hidden',
                                      transition: 'border-color 0.3s ease',
                                    }}
                                  >
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px'}}>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                                          <div style={{fontSize:12.5,color:DK.t1,fontWeight:700}}>{m.name}</div>
                                          {idx === 0 && (
                                            <span style={{
                                              fontSize:8,fontWeight:800,padding:'2px 6px',borderRadius:100,
                                              background:'linear-gradient(135deg,rgba(6,182,212,0.2),rgba(99,102,241,0.2))',
                                              color:DK.cyan,letterSpacing:'0.5px',
                                            }}>TOP</span>
                                          )}
                                        </div>
                                        <div style={{fontSize:10.5,color:DK.t3}}>
                                          {m.skill} • {Number.isFinite(m.distanceKm) ? `${m.distanceKm.toFixed(1)} km` : 'unknown dist.'}
                                          {m.available === false && <span style={{color:DK.red,marginLeft:4}}>• Busy</span>}
                                        </div>
                                      </div>
                                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                                        {/* Score badge */}
                                        <div style={{
                                          fontSize:13,fontWeight:800,color:scoreColor,
                                          background:`${scoreColor}15`,padding:'4px 10px',borderRadius:8,
                                          border:`1px solid ${scoreColor}25`,
                                        }}>
                                          {Math.round(m.assignmentScore * 100)}%
                                        </div>
                                        {/* Explain button */}
                                        <motion.button
                                          className="nmap-btn"
                                          whileHover={{ scale: 1.08 }}
                                          whileTap={{ scale: 0.92 }}
                                          onClick={() => handleExplainMatch(m)}
                                          disabled={isExplaining}
                                          title="AI Explain Match"
                                          style={{
                                            width:30,height:30,borderRadius:8,
                                            display:'flex',alignItems:'center',justifyContent:'center',
                                            background: explanation ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                                            border:`1px solid ${explanation ? 'rgba(6,182,212,0.3)' : DK.border}`,
                                            color: explanation ? DK.cyan : DK.t3,
                                            opacity: isExplaining ? 0.5 : 1,
                                          }}
                                        >
                                          {isExplaining ? (
                                            <motion.div
                                              animate={{ rotate: 360 }}
                                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            >
                                              <Sparkles size={13} />
                                            </motion.div>
                                          ) : (
                                            <MessageCircle size={13} />
                                          )}
                                        </motion.button>
                                      </div>
                                    </div>

                                    {/* AI Explanation card */}
                                    <AnimatePresence>
                                      {explanation && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                          style={{ overflow: 'hidden' }}
                                        >
                                          <div style={{
                                            margin: '0 10px 10px',
                                            padding: '10px 12px',
                                            borderRadius: 10,
                                            background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(99,102,241,0.04))',
                                            border: '1px solid rgba(6,182,212,0.12)',
                                          }}>
                                            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:6}}>
                                              <Sparkles size={10} color={DK.cyan} />
                                              <span style={{fontSize:9,fontWeight:700,color:DK.cyan,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                                                Gemini Analysis
                                              </span>
                                            </div>
                                            <div style={{
                                              fontSize: 11.5,
                                              color: DK.t2,
                                              lineHeight: 1.65,
                                              letterSpacing: '-0.01em',
                                            }}>
                                              {explanation}
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {/* Explain All button */}
                            {smartMatches.some(m => !matchExplanations[m.id]) && (
                              <motion.button
                                className="nmap-btn"
                                whileHover={{ scale: 1.02, y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => smartMatches.forEach(m => { if (!matchExplanations[m.id]) handleExplainMatch(m); })}
                                disabled={explainLoading.size > 0}
                                style={{
                                  width: '100%', marginTop: 10,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                  padding: '10px 14px', borderRadius: 10,
                                  background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(99,102,241,0.06))',
                                  border: '1px solid rgba(6,182,212,0.15)',
                                  color: DK.cyan, fontSize: 11.5, fontWeight: 700,
                                  opacity: explainLoading.size > 0 ? 0.6 : 1,
                                }}
                              >
                                <Brain size={13} />
                                {explainLoading.size > 0 ? 'Analyzing…' : 'Explain All Matches'}
                              </motion.button>
                            )}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8 }}>
                          <motion.button
                            className="nmap-btn"
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => onNav('volunteers', sel.id)}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                              padding: '12px 16px', borderRadius: 12,
                              background: `linear-gradient(135deg, ${DK.blue}, ${DK.indigo})`,
                              color: '#fff', fontSize: 13, fontWeight: 700,
                              boxShadow: `0 4px 16px ${DK.blueGlow}, 0 0 0 1px rgba(255,255,255,0.1) inset`,
                            }}
                          >
                            <UserPlus size={15} /> Assign Volunteer
                          </motion.button>

                          {sel.status !== 'resolved' && (
                            <motion.button
                              className="nmap-btn"
                              whileHover={{ scale: 1.02, y: -1 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleResolve}
                              disabled={resolving}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '12px 16px', borderRadius: 12,
                                background: 'rgba(16,185,129,0.1)',
                                color: DK.green, fontSize: 13, fontWeight: 700,
                                border: `1px solid rgba(16,185,129,0.2)`,
                                opacity: resolving ? 0.5 : 1,
                              }}
                            >
                              <CheckCircle2 size={15} />
                              {resolving ? 'Resolving...' : 'Resolve'}
                            </motion.button>
                          )}
                        </div>

                        {/* View task link */}
                        <div style={{ padding: '0 20px 20px' }}>
                          <motion.button
                            className="nmap-btn"
                            whileHover={{ scale: 1.01, x: 2 }}
                            onClick={() => onNav('tasks', { openModal: false, focusNeedId: sel.id })}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '12px 16px', borderRadius: 12,
                              background: DK.surfaceElevated, border: `1px solid ${DK.border}`,
                              color: DK.t2, fontSize: 12.5, fontWeight: 600,
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Eye size={14} /> View Full Task Details
                            </span>
                            <ChevronRight size={16} color={DK.t3} />
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <EmptyState />
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Divider */}
                <div style={{ height: 1, background: DK.border, margin: '0 20px' }} />

                {/* ═══ LOCATIONS LIST ═══ */}
                <div style={{ padding: '14px 20px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={14} color={DK.t3} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: DK.t1 }}>All Locations</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100,
                        background: 'rgba(59,130,246,0.1)', color: DK.blue,
                      }}>{filteredPins.length}</span>
                    </div>
                  </div>

                  {/* Scrollable list */}
                  <div style={{ maxHeight: 340, overflowY: 'auto' }} className="nmap-scroll">
                    {filteredPins.map((p, i) => {
                      const isSelected = selected === p.id;
                      const ai = getAISuggestion(p);
                      return (
                        <motion.div
                          key={p.id}
                          whileHover={{ x: 2, background: DK.surfaceHover }}
                          onClick={() => handlePinClick(p)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', cursor: 'pointer',
                            background: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                            borderRadius: 10, marginBottom: 2,
                            border: isSelected ? `1px solid rgba(59,130,246,0.15)` : '1px solid transparent',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: `${PCOLOR[p.priority]}10`,
                            border: `1px solid ${PCOLOR[p.priority]}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {p.priority === 'urgent'
                              ? <AlertTriangle size={15} color={PCOLOR[p.priority]} />
                              : <MapPin size={15} color={PCOLOR[p.priority]} />
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: DK.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.label}
                            </div>
                            <div style={{ fontSize: 11, color: DK.t3, marginTop: 1 }}>
                              {p.issue} · {p.region}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                              background: `${PCOLOR[p.priority]}15`, color: PCOLOR[p.priority],
                              textTransform: 'capitalize',
                            }}>
                              {p.priority}
                            </span>
                            <span style={{
                              fontSize: 8, fontWeight: 600, padding: '1px 6px', borderRadius: 100,
                              background: `${ai.color}10`, color: ai.color,
                              display: 'flex', alignItems: 'center', gap: 2,
                            }}>
                              <Sparkles size={7} /> AI
                            </span>
                            {assignedIncidentIds.has(String(p.id)) && (
                              <span style={{
                                fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                                background: 'rgba(34,211,238,0.15)', color: '#22D3EE',
                              }}>
                                Assigned
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ FLOATING ACTION BUTTON ═══ */}
        <motion.button
          className="nmap-btn"
          whileHover={{ scale: 1.08, boxShadow: `0 8px 32px ${DK.blueGlow}, 0 0 60px ${DK.blueGlow}` }}
          whileTap={{ scale: 0.92 }}
          animate={{
            boxShadow: [
              `0 4px 20px ${DK.blueGlow}`,
              `0 8px 40px ${DK.blueGlow}, 0 0 40px rgba(99,102,241,0.15)`,
              `0 4px 20px ${DK.blueGlow}`,
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          onClick={() => {
            setPinCreateMode(v => !v);
            setSelected(null);
          }}
          style={{
            position: 'absolute', bottom: 24,
            right: sidebarOpen ? 404 : 120,
            zIndex: 1001,
            width: 56, height: 56, borderRadius: '50%',
            background: pinCreateMode
              ? `linear-gradient(135deg, ${DK.cyan}, ${DK.blue})`
              : `linear-gradient(135deg, ${DK.blue}, ${DK.indigo})`,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.15)',
            transition: 'right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <motion.div
            animate={{ rotate: pinCreateMode ? 45 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <Crosshair size={22} />
          </motion.div>
        </motion.button>
      </div>
    </motion.div>
  );
}
