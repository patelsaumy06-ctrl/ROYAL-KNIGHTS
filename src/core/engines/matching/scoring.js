/**
 * Matching Scoring Module - Semantic Scoring Algorithms
 *
 * Upgraded from naive string-includes to:
 *  1. Semantic skill matching via skill ontology (semanticSkills.js)
 *  2. IDF-weighted skill scoring (rare skills score higher when matched)
 *  3. Continuous proximity decay curve (replaces step-function distance buckets)
 *  4. Composite score with configurable weights (from contextWeights.js)
 *
 * All scores return 0–100 scale.
 */

import { haversineDistanceKm } from '../../../utils/geo';
import { semanticSkillScore } from './semanticSkills';
export { DEFAULT_WEIGHTS } from './contextWeights';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toFinite = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const toPoint = (item) => {
  const lat = Number(item?.location?.lat ?? item?.lat);
  const lng = Number(item?.location?.lng ?? item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * Semantic skill score (0–100) — replaces naive string.includes().
 *
 * Uses the skill ontology for synonym expansion + IDF weighting.
 * Synonym match = full credit × IDF weight.
 * Related-cluster match = 0.55 credit × IDF weight.
 *
 * @param {string[]} volunteerSkillsRaw
 * @param {string[]} requiredSkillsRaw
 * @returns {number} 0–100
 */
export function calculateSkillScore(volunteerSkillsRaw, requiredSkillsRaw) {
  return semanticSkillScore(volunteerSkillsRaw, requiredSkillsRaw);
}

/**
 * Continuous proximity decay (0–100).
 *
 * OLD approach: step-function buckets (<1km=100, <3km=90, <5km=80 …)
 * NEW approach: smooth exponential decay — distance_score = 100 × e^(−λ × d)
 *   where λ = 0.06 gives ≈ 55 at 10 km, ≈ 30 at 20 km, ≈ 9 at 40 km.
 *
 * This means every extra kilometre meaningfully reduces the score
 * rather than scoring identically within a bucket.
 *
 * @param {number} distanceKm
 * @returns {number} 0–100
 */
export function calculateDistanceScore(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 30;
  const score = 100 * Math.exp(-0.06 * distanceKm);
  return clamp(Math.round(score), 0, 100);
}

/**
 * Proximity score between two location objects.
 * @param {Object} volunteerLocation
 * @param {Object} taskLocation
 * @returns {number} 0–100
 */
export function calculateProximityScore(volunteerLocation, taskLocation) {
  const vPt = toPoint(volunteerLocation);
  const tPt = toPoint(taskLocation);
  if (!vPt || !tPt) return 30;
  return calculateDistanceScore(haversineDistanceKm(vPt, tPt));
}

/**
 * Availability score (0–100).
 * Adds nuance for "on-call" and partial availability states.
 * @param {string} status
 * @param {boolean} available
 * @returns {number} 0–100
 */
export function calculateAvailabilityScore(status, available) {
  const s = String(status || '').toLowerCase();
  if (available === false || s === 'busy' || s === 'assigned') return 25;
  if (s === 'soon' || s === 'on-call' || s === 'standby') return 70;
  if (s === 'available' || available === true) return 100;
  return 85; // unknown status → optimistic
}

/**
 * Experience score from completed task count (0–100).
 * Uses a logarithmic curve: big jumps early, diminishing returns after 20+.
 *
 * OLD: step buckets (>=50→95, >=20→80…)
 * NEW: log curve — score = min(100, 30 + 25 × log2(tasks + 1))
 *
 * @param {number} completed
 * @returns {number} 0–100
 */
export function calculateExperienceScore(completed = 0) {
  const safe = Math.max(0, toFinite(completed, 0));
  const score = 30 + 25 * Math.log2(safe + 1);
  return clamp(Math.round(score), 30, 100);
}

/**
 * Performance score from 0–5 star rating (0–100).
 * @param {number} rating
 * @returns {number} 0–100
 */
export function calculatePerformanceScore(rating = 3) {
  return Math.round((clamp(toFinite(rating, 3), 0, 5) / 5) * 100);
}

/** Quality label */
export function getMatchQualityLabel(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'very_good';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/** Human-readable match label */
export function getMatchLabel(score) {
  if (score >= 90) return 'Perfect Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Weighted composite score.
 * @param {Object} scores  - { skill, distance, availability, experience, performance }
 * @param {Object} weights - Must sum to ~1
 * @returns {number} 0–100
 */
export function calculateCompositeScore(scores, weights) {
  const w = weights || {};
  const composite =
    (scores.skill || 0) * (w.skill ?? 0.4) +
    (scores.distance || 0) * (w.distance ?? 0.25) +
    (scores.availability || 0) * (w.availability ?? 0.15) +
    (scores.experience || 0) * (w.experience ?? 0.10) +
    (scores.performance || 0) * (w.performance ?? 0.10);
  return clamp(Math.round(composite), 0, 100);
}