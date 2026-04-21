import { haversineDistanceKm } from '../../utils/geo';

export const DEFAULT_WEIGHTS = {
  skill: 0.4,
  distance: 0.25,
  availability: 0.15,
  experience: 0.1,
  performance: 0.1,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toFinite = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const normalizeToken = (v) =>
  String(v || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

const normalizeList = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(normalizeToken).filter(Boolean))];
};

const toPoint = (item) => {
  const lat = Number(item?.location?.lat ?? item?.lat);
  const lng = Number(item?.location?.lng ?? item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

export function calculateSkillScore(volunteerSkillsRaw, requiredSkillsRaw) {
  const volSkills = normalizeList(volunteerSkillsRaw);
  const reqSkills = normalizeList(requiredSkillsRaw);

  if (reqSkills.length === 0) return 50;
  if (volSkills.length === 0) return 0;

  const matched = reqSkills.reduce((count, req) => {
    return volSkills.some((v) => v === req || v.includes(req) || req.includes(v)) ? count + 1 : count;
  }, 0);

  return (matched / reqSkills.length) * 100;
}

export function calculateDistanceScore(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 30;
  if (distanceKm < 1) return 100;
  if (distanceKm < 5) return 80;
  if (distanceKm < 10) return 60;
  return 30;
}

export function calculateProximityScore(volunteerLocation, taskLocation) {
  const vPt = toPoint(volunteerLocation);
  const tPt = toPoint(taskLocation);
  
  if (!vPt || !tPt) return 30;
  
  const distanceKm = haversineDistanceKm(vPt, tPt);
  return calculateDistanceScore(distanceKm);
}

export function calculateAvailabilityScore(status, available) {
  if (available === false || String(status || '').toLowerCase() === 'busy') return 30;
  if (String(status || '').toLowerCase() === 'soon') return 70;
  return 100;
}

export function calculateExperienceScore(completed = 0) {
  const safe = Math.max(0, toFinite(completed, 0));
  if (safe > 50) return 100;
  if (safe >= 20) return 80;
  if (safe >= 5) return 60;
  return 40;
}

export function calculatePerformanceScore(rating = 0) {
  return (clamp(toFinite(rating, 3), 0, 5) / 5) * 100;
}

export function getMatchQualityLabel(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'very_good';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function getMatchLabel(score) {
  if (score >= 90) return 'Perfect Match';
  if (score >= 70) return 'Strong Match';
  if (score >= 50) return 'Moderate Match';
  return 'Low Match';
}
