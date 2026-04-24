import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { resolveNeedCoordinates } from '../data/gujaratPlaces';
import { haversineKm } from '../utils/geo';
import { validateNeed, validateVolunteer } from '../utils/validation';
import {
  createIncident as createIncidentDoc,
  deleteIncident as deleteIncidentDoc,
  getAllIncidents,
  updateIncidentStatus,
} from './firestoreRealtime';



export const NGO_TYPES = [
  "Health",
  "Education",
  "Disaster Relief"
];

/* ═══════════════════════════════════════════════════════════════════════
   BLANK DB — used for new NGOs with no data yet
═══════════════════════════════════════════════════════════════════════ */
const BLANK_DB = () => ({
  stats: { totalNeeds: 0, volunteers: 0, resolved: 0, urgent: 0 },
  needs: [], volunteers: [], notifications: [], uploads: [],
  chartData: {
    categories: [], regions: [],
    trends: [
      { month:"Oct",value:0 },{ month:"Nov",value:0 },{ month:"Dec",value:0 },
      { month:"Jan",value:0 },{ month:"Feb",value:0 },{ month:"Mar",value:0 },
    ],
    resolution: [],
  },
});

/* ─── FIREBASE FIRESTORE API INTEGRATION ─── */
let _currentEmail = null;
const _cache = new Map();

function computeDynamicChartData(needs, existingChartData) {
  const cats = {}, regs = {}, res = {};
  needs.forEach(n => {
    cats[n.category] = (cats[n.category] || 0) + 1;
    regs[n.region]   = (regs[n.region]   || 0) + 1;
    if (n.status === "resolved") res[n.category] = (res[n.category] || 0) + 1;
  });
  const colors = ["#2563EB","#EF4444","#F59E0B","#7C3AED","#16A34A","#0891B2","#EC4899"];
  const categories = Object.entries(cats)
    .map(([label, value], i) => ({ label: label.substring(0,10), value, color: colors[i % colors.length] }))
    .sort((a,b) => b.value - a.value);
  const regions = Object.entries(regs)
    .map(([label, value]) => ({ label: label.substring(0,10), value }))
    .sort((a,b) => b.value - a.value);
  const resolution = Object.entries(cats)
    .map(([label, total]) => {
      const solved = res[label] || 0;
      return { label: label.substring(0,10), value: total > 0 ? Math.round((solved / total) * 100) : 0 };
    })
    .filter(c => c.value > 0)
    .sort((a,b) => b.value - a.value);
  return {
    ...existingChartData,
    categories: categories.length ? categories : existingChartData?.categories || [],
    regions:    regions.length    ? regions    : existingChartData?.regions    || [],
    resolution: resolution.length ? resolution : existingChartData?.resolution || [],
  };
}

const VOL_LOCATIONS = {
  "Arjun Kumar":    { lat: 23.5880, lng: 72.3693 },
  "Sonal Raval":    { lat: 23.6997, lng: 72.5469 },
  "Rohit Desai":    { lat: 24.1725, lng: 72.4383 },
  "Vijay Patel":    { lat: 23.8002, lng: 72.3925 },
  "Dev Pandya":     { lat: 23.7861, lng: 72.6361 },
  "Priya Mehta":    { lat: 23.8493, lng: 72.1266 },
  "Neha Kaur":      { lat: 23.9161, lng: 72.3802 },
  "Meena Joshi":    { lat: 23.7000, lng: 71.7833 },
  "Rajan Vora":     { lat: 23.8333, lng: 71.6000 },
  "Kiran Barot":    { lat: 24.5083, lng: 72.0217 },
  "Suresh Nayak":   { lat: 24.1725, lng: 72.4383 },
  "Lata Chaudhary": { lat: 24.2581, lng: 72.1890 },
  "Amish Solanki":  { lat: 24.0333, lng: 72.3333 },
  "Dhruv Rana":     { lat: 24.3961, lng: 71.6256 },
  "Foram Trivedi":  { lat: 24.1333, lng: 71.4833 },
  "Anita Shah":     { lat: 23.2156, lng: 72.6369 },
};

const getNgoRef = () => doc(db, "ngos", _currentEmail);

const fetchOrInitData = async () => {
  if (!_currentEmail) return BLANK_DB();
  if (_cache.has(_currentEmail)) return _cache.get(_currentEmail);

  const snap = await getDoc(getNgoRef());
  // If no Firestore doc exists yet, create it with a blank DB so updateDoc never fails.
  let data;
  if (snap.exists()) {
    data = snap.data();
  } else {
    data = BLANK_DB();
    await setDoc(getNgoRef(), data); // ← CREATE the document first
  }

  if (data.needs) {
    data.needs = data.needs.map((n) => {
      if (n.lat != null && n.lng != null) return n;
      const { lat, lng } = resolveNeedCoordinates(n);
      return { ...n, lat, lng };
    });
  }

  if (data.volunteers) {
    data.volunteers = data.volunteers.map(v => {
      const loc = VOL_LOCATIONS[v.name];
      return loc ? { ...v, lat: loc.lat, lng: loc.lng, distance: 0 } : v;
    });
  }

  data.chartData = computeDynamicChartData(data.needs || [], data.chartData);
  _cache.set(_currentEmail, data);
  return data;
};

export const api = {
  setAccount: (email) => { _currentEmail = email; },
  cached: () => _cache.get(_currentEmail) || null,

  getStats:         async () => { const d = await fetchOrInitData(); return d.stats         || BLANK_DB().stats; },
  getVolunteers:    async () => { const d = await fetchOrInitData(); return d.volunteers    || []; },
  getNotifications: async () => { const d = await fetchOrInitData(); return d.notifications || []; },
  getUploads:       async () => { const d = await fetchOrInitData(); return d.uploads       || []; },
  getChartData:     async () => { const d = await fetchOrInitData(); return d.chartData     || BLANK_DB().chartData; },

  getNeeds: async () => {
    if (_currentEmail) {
      try {
        return await getAllIncidents(_currentEmail);
      } catch (error) {
        console.warn('Falling back to cached needs after incident fetch failure', error);
      }
    }
    const d = await fetchOrInitData();
    return d.needs || [];
  },

  assignVolunteer: async (volId, needId) => {
    const data = await fetchOrInitData();
    const needs      = data.needs.map(n => n.id === needId ? { ...n, assigned: Math.min(n.assigned + 1, n.volunteers) } : n);
    const volunteers = data.volunteers.map(v => v.id === volId ? { ...v, available: false, tasks: v.tasks + 1 } : v);
    const chartData  = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, volunteers, chartData });
    await updateDoc(getNgoRef(), { needs, volunteers });
    return { success: true, message: `Volunteer #${volId} assigned to need #${needId}` };
  },

  markRead: async (id) => {
    const data          = await fetchOrInitData();
    const notifications = data.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    _cache.set(_currentEmail, { ...data, notifications });
    await updateDoc(getNgoRef(), { notifications });
    return true;
  },

  markAllRead: async () => {
    const data          = await fetchOrInitData();
    const notifications = data.notifications.map(n => ({ ...n, read: true }));
    _cache.set(_currentEmail, { ...data, notifications });
    await updateDoc(getNgoRef(), { notifications });
    return true;
  },

  resolveNeed: async (id) => {
    if (_currentEmail) {
      await updateIncidentStatus(_currentEmail, id, 'resolved');
      return true;
    }
    const data      = await fetchOrInitData();
    const needs     = data.needs.map(n => n.id === id ? { ...n, status: "resolved" } : n);
    const stats     = {
      ...data.stats,
      resolved:   needs.filter(n => n.status === "resolved").length,
      urgent:     needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length,
      totalNeeds: needs.filter(n => n.status !== "resolved").length,
    };
    const chartData = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, stats, chartData });
    await updateDoc(getNgoRef(), { needs, stats });
    return true;
  },

  deleteNeed: async (id) => {
    if (_currentEmail) {
      await deleteIncidentDoc(_currentEmail, id);
      return true;
    }
    const data      = await fetchOrInitData();
    const needs     = data.needs.filter(n => n.id !== id);
    const stats     = {
      ...data.stats,
      resolved:   needs.filter(n => n.status === "resolved").length,
      urgent:     needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length,
      totalNeeds: needs.filter(n => n.status !== "resolved").length,
    };
    const chartData = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, stats, chartData });
    await updateDoc(getNgoRef(), { needs, stats, chartData });
    return true;
  },

  addNeed: async (newNeed) => {
    const validation = validateNeed(newNeed, { ngoEmail: _currentEmail });
    if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] || "Invalid need data.");
    const safeNeed = validation.sanitizedData;
    if (_currentEmail) {
      const docId = await createIncidentDoc(_currentEmail, safeNeed);
      return { ...safeNeed, id: docId };
    }
    const data          = await fetchOrInitData();
    const needs         = [safeNeed, ...data.needs];
    const stats         = { ...data.stats, totalNeeds: needs.filter(n => n.status !== "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const chartData     = computeDynamicChartData(needs, data.chartData);
    const notifications = [{ id: data.notifications.length + 1, type:"task", title:`Task Added: ${safeNeed.category}`, body:`New ${safeNeed.priority} task queued for ${safeNeed.region}.`, time:"Just now", read:false }, ...data.notifications];
    _cache.set(_currentEmail, { ...data, needs, stats, chartData, notifications });
    await updateDoc(getNgoRef(), { needs, stats, notifications });
    return safeNeed;
  },

  addVolunteer: async (newVol) => {
    const validation = validateVolunteer(newVol, { ngoEmail: _currentEmail });
    if (!validation.isValid) throw new Error(Object.values(validation.errors)[0] || "Invalid volunteer data.");
    const data         = await fetchOrInitData();
    const safeVol      = validation.sanitizedData;
    const volunteers   = [...data.volunteers, safeVol];
    const stats        = { ...data.stats, volunteers: volunteers.length };
    const notifications = [{ id: data.notifications.length + 1, type:"info", title:`New Volunteer: ${safeVol.name} (${safeVol.skill})`, body:`Joined ${safeVol.region} volunteer pool.`, time:"Just now", read:false }, ...data.notifications];
    _cache.set(_currentEmail, { ...data, volunteers, stats, notifications });
    await updateDoc(getNgoRef(), { volunteers, stats, notifications });
    return { volunteers, stats };
  },

  saveUploadNeeds: async (newNeeds, newUpload, newNotification) => {
    const data          = await fetchOrInitData();
    const needs         = [...data.needs, ...newNeeds];
    const stats         = { ...data.stats, totalNeeds: needs.filter(n => n.status !== "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const chartData     = computeDynamicChartData(needs, data.chartData);
    const uploads       = [newUpload, ...data.uploads];
    const notifications = [newNotification, ...data.notifications];
    _cache.set(_currentEmail, { ...data, needs, stats, uploads, notifications, chartData });
    await updateDoc(getNgoRef(), { needs, stats, uploads, notifications });
    return uploads;
  },

  activateEmergencyMode: async () => {
    const data       = await fetchOrInitData();
    const needs      = data.needs || [];
    const volunteers = data.volunteers || [];

    const ref      = needs.find(n => n.priority === "urgent" && (n.status === "open" || n.status === "active")) || needs.find(n => n.status === "open") || needs[0];
    const lat      = ref?.lat      ?? 23.588;
    const lng      = ref?.lng      ?? 72.369;
    const region   = ref?.region   ?? "Mehsana";
    const siteName = ref?.location ?? "Command area";

    const newNeed = {
      id: Date.now(), location: `Emergency — ${siteName}`, category: "Emergency Response",
      region, priority: "urgent", volunteers: 8, assigned: 1, status: "active",
      deadline: new Date(Date.now() + 86400000).toISOString().split("T")[0], lat, lng,
    };

    const withCoords = volunteers.filter(v => v.lat != null && v.lng != null);
    if (!withCoords.length) return { success: false, error: "No volunteers with coordinates on file." };

    const pool = withCoords.filter(v => v.available).length ? withCoords.filter(v => v.available) : withCoords;
    let nearest = pool[0], distanceKm = haversineKm(lat, lng, nearest.lat, nearest.lng);
    for (let i = 1; i < pool.length; i++) {
      const d = haversineKm(lat, lng, pool[i].lat, pool[i].lng);
      if (d < distanceKm) { distanceKm = d; nearest = pool[i]; }
    }

    const updatedVolunteers = volunteers.map(v => v.id === nearest.id ? { ...v, available: false, tasks: (v.tasks || 0) + 1 } : v);
    const allNeeds   = [newNeed, ...needs];
    const stats      = { ...data.stats, totalNeeds: allNeeds.filter(n => n.status !== "resolved").length, urgent: allNeeds.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const chartData  = computeDynamicChartData(allNeeds, data.chartData);
    const distLabel  = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km` : "nearby";
    const nextId     = (data.notifications || []).reduce((m,n) => Math.max(m, Number(n.id) || 0), 0) + 1;
    const assignNotif = { id: nextId, type:"urgent", title:`Emergency task assigned: ${nearest.name}`, body:`Urgent need at ${siteName}. ${nearest.name} (${distLabel}) auto-assigned.`, time:"Just now", read:false };
    const notifications = [assignNotif, ...(data.notifications || [])];

    _cache.set(_currentEmail, { ...data, needs: allNeeds, volunteers: updatedVolunteers, notifications, stats, chartData });
    await updateDoc(getNgoRef(), { needs: allNeeds, volunteers: updatedVolunteers, notifications, stats, chartData });
    return { success: true, need: newNeed, volunteer: nearest, distanceKm: Number.isFinite(distanceKm) ? distanceKm : null };
  },

  simulateIncident: async () => {
    const data  = await fetchOrInitData();
    const types = [
      { cat:"Flood Alert",       loc:"Santhal",   reg:"Mehsana",     priority:"urgent", vol:12 },
      { cat:"Water Shortage",    loc:"Radhanpur", reg:"Patan",       priority:"urgent", vol:8  },
      { cat:"Medical Emergency", loc:"Deesa",     reg:"Banaskantha", priority:"urgent", vol:6  },
    ];
    const item    = types[Math.floor(Math.random() * types.length)];
    const newNeed = { id: Date.now(), location: item.loc, category: item.cat, region: item.reg, priority: item.priority, volunteers: item.vol, assigned: 0, status: "open", deadline: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0] };
    const needs   = [newNeed, ...data.needs];
    const stats   = { ...data.stats, totalNeeds: needs.filter(n => n.status !== "resolved").length, urgent: needs.filter(n => n.priority === "urgent" && n.status !== "resolved").length };
    const newNotification = { id: Date.now() + 1, type:"urgent", title:`CRITICAL: ${item.cat} in ${item.loc}`, body:`Immediate coordination required. ${item.vol} volunteers needed.`, time:"Just now", read:false };
    const notifications   = [newNotification, ...data.notifications];
    const chartData       = computeDynamicChartData(needs, data.chartData);
    _cache.set(_currentEmail, { ...data, needs, stats, notifications, chartData });
    await updateDoc(getNgoRef(), { needs, stats, notifications });
    return { newNeed, newNotification };
  },
};