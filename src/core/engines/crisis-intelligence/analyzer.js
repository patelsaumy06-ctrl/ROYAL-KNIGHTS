/**
 * Crisis Intelligence Analyzer
 * 
 * Advanced crisis analysis system that evaluates incidents, calculates risk scores,
 * and generates actionable insights for emergency response coordination.
 * 
 * @module CrisisAnalyzer
 */

import { haversineDistanceKm } from '../../../utils/geo';

const SEVERITY_WEIGHT = {
  critical: 1,
  high: 0.8,
  medium: 0.55,
  low: 0.3,
};

const INCIDENT_WEIGHT = {
  flood: 1,
  fire: 0.95,
  medical: 0.9,
  rescue: 0.85,
  drought: 0.75,
  default: 0.6,
};

const SKILL_MATCH = {
  medical: ['medical', 'doctor', 'nurse', 'emt'],
  flood: ['boat', 'rescue', 'logistics'],
  fire: ['fire', 'rescue', 'emergency'],
  drought: ['water', 'distribution', 'logistics'],
  default: ['rescue', 'volunteer', 'logistics'],
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const levelByScore = (score) => {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const scoreResourceFit = (incident, resources = []) => {
  if (!resources.length) return 0.4;
  const type = normalize(incident.type);
  const medicalNeed = type.includes('medical') || type.includes('injury');
  const vehicleNeed = ['flood', 'fire', 'rescue'].some((k) => type.includes(k));
  let score = 0.35;

  resources.forEach((res) => {
    const kind = normalize(res.type);
    const qty = Math.max(0, toNumber(res.quantity, 1));
    const available = res.availability !== false;
    if (!available) return;
    if (medicalNeed && kind.includes('medical')) score += 0.25 * Math.min(1, qty / 5);
    if (vehicleNeed && (kind.includes('ambulance') || kind.includes('vehicle') || kind.includes('truck'))) {
      score += 0.22 * Math.min(1, qty / 3);
    }
  });

  return Math.max(0.05, Math.min(1, score));
};

const scoreVolunteerMatch = (incident, volunteers = []) => {
  if (!volunteers.length) return { score: 0.2, selected: [], nearbyCount: 0 };
  const incidentType = normalize(incident.type);
  const requiredSkills = Object.entries(SKILL_MATCH).find(([key]) => incidentType.includes(key))?.[1] || SKILL_MATCH.default;

  const scored = volunteers
    .filter((v) => v?.location || (v?.lat != null && v?.lng != null))
    .map((vol) => {
      const point = vol.location || { lat: vol.lat, lng: vol.lng };
      const distanceKm = haversineDistanceKm(point, incident.location);
      const skills = normalize(vol.skills?.join(' ') || vol.skill);
      const skillHits = requiredSkills.filter((s) => skills.includes(s)).length;
      const skillScore = skillHits > 0 ? Math.min(1, 0.4 + skillHits * 0.2) : 0.2;
      const availabilityScore = vol.available === false ? 0.35 : 1;
      const distanceScore = Number.isFinite(distanceKm) ? 1 / (1 + distanceKm / 10) : 0.1;
      const finalScore = (skillScore * 0.45 + availabilityScore * 0.2 + distanceScore * 0.35);
      return { ...vol, distanceKm, assignmentScore: finalScore };
    })
    .sort((a, b) => b.assignmentScore - a.assignmentScore);

  const selected = scored.slice(0, 5);
  const nearbyCount = scored.filter((v) => Number.isFinite(v.distanceKm) && v.distanceKm <= 15).length;
  const score = selected.length ? selected.reduce((sum, item) => sum + item.assignmentScore, 0) / selected.length : 0.2;
  return { score: Math.max(0.1, Math.min(1, score)), selected, nearbyCount };
};

/**
 * Analyze crisis data and generate decisions for each incident
 * @param {Object} data - Crisis data containing incidents, volunteers, and resources
 * @returns {Object} Analysis with decisions, priority zones, and predictions
 */
export function analyzeCrisisData(data) {
  const incidents = Array.isArray(data?.incidents) ? data.incidents : [];
  const volunteers = Array.isArray(data?.volunteers) ? data.volunteers : [];
  const resources = Array.isArray(data?.resources) ? data.resources : [];

  const decisions = incidents
    .filter((incident) => incident?.location && Number.isFinite(toNumber(incident.location.lat, NaN)))
    .map((incident) => {
      const severity = normalize(incident.severity || 'medium');
      const typeScore = INCIDENT_WEIGHT[normalize(incident.type)] ?? INCIDENT_WEIGHT.default;
      const volunteerMatch = scoreVolunteerMatch(incident, volunteers);
      const resourceFit = scoreResourceFit(incident, resources);

      let severityScore = SEVERITY_WEIGHT[severity] ?? 0.5;

      if (incident.llmInsights) {
        const llmUrgency = normalize(incident.llmInsights.urgency_level || '');
        const llmConfidence = Number(incident.llmInsights.confidence_score) || 0;

        if (llmConfidence >= 0.7 && llmUrgency) {
          const llmSeverityMap = { high: 1, critical: 1, medium: 0.55, low: 0.3 };
          const llmSeverity = llmSeverityMap[llmUrgency];
          if (llmSeverity != null) {
            severityScore = (llmSeverity * llmConfidence) + (severityScore * (1 - llmConfidence));
          }
        }
      }

      const rawRisk = Math.round((severityScore * 45 + typeScore * 25 + (1 - volunteerMatch.score) * 20 + (1 - resourceFit) * 10) * 100) / 100;
      const riskScore = Math.max(0, Math.min(100, Math.round(rawRisk)));
      const priority = levelByScore(riskScore);

      const volunteerCount = Math.min(
        Math.max(1, Math.ceil((riskScore / 30) + (severity === 'critical' ? 2 : 0))),
        volunteerMatch.selected.length || 1
      );
      const ambulanceCount = normalize(incident.type).includes('medical') || severity === 'critical' ? 1 : 0;
      const action = `Send ${volunteerCount} volunteers${ambulanceCount ? ` + ${ambulanceCount} ambulance` : ''} to ${incident.location.label || 'incident site'}`;

      let escalationBase = riskScore / 100 + (severity === 'critical' ? 0.15 : 0);
      let confidenceBase = 0.6 + volunteerMatch.score * 0.2 + resourceFit * 0.2;

      if (incident.llmInsights) {
        const llmConf = Number(incident.llmInsights.confidence_score) || 0;
        if (llmConf >= 0.7) {
          confidenceBase = Math.max(confidenceBase, 0.5 + llmConf * 0.3);
        }
        if (normalize(incident.llmInsights.urgency_level) === 'high' ||
            normalize(incident.llmInsights.urgency_level) === 'critical') {
          escalationBase += 0.08;
        }
      }

      return {
        incidentId: incident.id,
        location: incident.location,
        type: incident.type,
        severity,
        riskScore,
        priority,
        suggestedAction: action,
        recommendedVolunteers: volunteerMatch.selected.slice(0, volunteerCount),
        predictions: {
          escalationProbability: Math.min(0.98, Number(escalationBase.toFixed(2))),
          expectedResponseTimeMinutes: Math.max(8, Math.round(12 + (riskScore / 4) - volunteerMatch.nearbyCount)),
          confidence: Math.max(0.55, Number(confidenceBase.toFixed(2))),
        },
        resourceAnalysis: {
          availableResources: resourceFit,
          volunteerReadiness: volunteerMatch.score,
          nearbyVolunteers: volunteerMatch.nearbyCount,
        },
        ...(incident.llmInsights ? { llmInsights: incident.llmInsights } : {}),
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const priorityZones = {
    high: decisions.filter((d) => d.priority === 'high'),
    medium: decisions.filter((d) => d.priority === 'medium'),
    low: decisions.filter((d) => d.priority === 'low'),
  };

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalIncidents: decisions.length,
      highPriorityCount: priorityZones.high.length,
      mediumPriorityCount: priorityZones.medium.length,
      lowPriorityCount: priorityZones.low.length,
      averageRiskScore: decisions.length
        ? Math.round(decisions.reduce((sum, item) => sum + item.riskScore, 0) / decisions.length)
        : 0,
    },
    priorityZones,
    suggestedActions: decisions.map((item) => ({
      incidentId: item.incidentId,
      priority: item.priority,
      action: item.suggestedAction,
      riskScore: item.riskScore,
    })),
    riskPredictions: decisions.map((item) => ({
      incidentId: item.incidentId,
      ...item.predictions,
    })),
    decisions,
  };
}

/**
 * Get crisis summary for quick overview
 * @param {Object} analysis - Crisis analysis result
 * @returns {Object} Simplified summary
 */
export function getCrisisSummary(analysis) {
  return {
    totalIncidents: analysis.summary.totalIncidents,
    criticalCount: analysis.priorityZones.high.length,
    averageRisk: analysis.summary.averageRiskScore,
    topPriority: analysis.decisions[0] || null,
    requiresEscalation: analysis.priorityZones.high.length > 3 || 
                        analysis.summary.averageRiskScore > 70,
  };
}
