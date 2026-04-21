/**
 * Crisis Auto-Response System
 * 
 * Automatically coordinates emergency response by:
 * - Assigning volunteers to incidents based on proximity and skills
 * - Allocating resources based on incident requirements
 * - Estimating response times
 * - Tracking resource utilization
 * 
 * @module CrisisAutoResponse
 */

import { analyzeCrisisData } from './analyzer';
import { haversineDistanceKm } from '../../../utils/geo';

const PRIORITY_SCORE = { high: 3, medium: 2, low: 1 };

const SKILL_BY_TYPE = {
  medical: ['medical', 'doctor', 'nurse', 'emt', 'health'],
  fire: ['fire', 'rescue', 'emergency'],
  flood: ['boat', 'rescue', 'logistics', 'water'],
  rescue: ['rescue', 'search', 'emergency'],
  drought: ['water', 'distribution', 'logistics'],
  default: ['volunteer', 'rescue', 'logistics'],
};

const RESOURCE_HINTS = [
  { key: 'ambulance', aliases: ['ambulance', 'medical vehicle'] },
  { key: 'medical kits', aliases: ['medical kit', 'medical kits', 'first aid', 'medicine'] },
  { key: 'vehicles', aliases: ['vehicle', 'truck', 'transport'] },
  { key: 'boats', aliases: ['boat', 'boats'] },
  { key: 'water tanker', aliases: ['water tanker', 'water'] },
];

const normalize = (value) => String(value || '').trim().toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPoint = (item) => {
  if (item?.location && Number.isFinite(toNumber(item.location.lat, NaN))) {
    return { lat: toNumber(item.location.lat), lng: toNumber(item.location.lng) };
  }
  if (Number.isFinite(toNumber(item?.lat, NaN)) && Number.isFinite(toNumber(item?.lng, NaN))) {
    return { lat: toNumber(item.lat), lng: toNumber(item.lng) };
  }
  return null;
};

const getRequiredSkills = (incidentType) => {
  const type = normalize(incidentType);
  const matched = Object.keys(SKILL_BY_TYPE).find((key) => key !== 'default' && type.includes(key));
  return SKILL_BY_TYPE[matched || 'default'];
};

const deriveResourceDemand = (decision) => {
  const type = normalize(decision?.type);
  const severity = normalize(decision?.severity);
  const actionText = normalize(decision?.suggestedAction);
  const demand = [];

  if (type.includes('medical') || severity === 'critical' || actionText.includes('ambulance')) {
    demand.push({ type: 'ambulance', quantity: 1 });
    demand.push({ type: 'medical kits', quantity: severity === 'critical' ? 2 : 1 });
  }
  if (type.includes('flood')) demand.push({ type: 'boats', quantity: 1 });
  if (type.includes('fire') || type.includes('rescue')) demand.push({ type: 'vehicles', quantity: 1 });
  if (type.includes('drought') || type.includes('water')) demand.push({ type: 'water tanker', quantity: 1 });

  RESOURCE_HINTS.forEach((item) => {
    if (item.aliases.some((alias) => actionText.includes(alias))) {
      demand.push({ type: item.key, quantity: 1 });
    }
  });

  if (!demand.length) demand.push({ type: 'vehicles', quantity: 1 });
  return demand;
};

const matchResource = (resource, requestType) => {
  const kind = normalize(resource?.type);
  const target = normalize(requestType);
  if (kind === target) return true;
  return RESOURCE_HINTS.some(
    (hint) =>
      hint.key === target &&
      [hint.key, ...hint.aliases].some((alias) => kind.includes(normalize(alias)))
  );
};

const findNearestVolunteers = (incident, volunteers = [], requiredSkills = [], limit = 3) => {
  const incidentPoint = getPoint(incident);
  if (!incidentPoint) return [];

  return volunteers
    .filter((vol) => vol && vol.available !== false && getPoint(vol))
    .map((vol) => {
      const volPoint = getPoint(vol);
      const distanceKm = haversineDistanceKm(volPoint, incidentPoint);
      const skillText = normalize(vol.skills?.join(' ') || vol.skill);
      const skillHits = requiredSkills.filter((skill) => skillText.includes(skill)).length;
      const skillScore = requiredSkills.length ? skillHits / requiredSkills.length : 0;
      const proximityScore = Number.isFinite(distanceKm) ? 1 / (1 + distanceKm / 10) : 0;
      const finalScore = skillScore * 0.65 + proximityScore * 0.35;
      return { ...vol, distanceKm, assignmentScore: finalScore, skillHits };
    })
    .sort((a, b) => b.assignmentScore - a.assignmentScore)
    .slice(0, Math.max(0, limit));
};

const allocateResources = (requests = [], resources = []) => {
  const allocations = [];

  requests.forEach((request) => {
    let remaining = Math.max(0, toNumber(request.quantity, 0));
    resources.forEach((resource) => {
      if (remaining <= 0) return;
      if (resource.availability === false) return;
      if (!matchResource(resource, request.type)) return;

      const availableQty = Math.max(0, toNumber(resource.quantity, 0));
      if (!availableQty) return;

      const usedQty = Math.min(remaining, availableQty);
      if (usedQty <= 0) return;

      resource.quantity = availableQty - usedQty;
      if (resource.quantity <= 0) resource.availability = false;
      remaining -= usedQty;

      allocations.push({
        type: resource.type,
        quantity: usedQty,
      });
    });
  });

  return allocations;
};

const estimateEtaMinutes = (incident, volunteers) => {
  if (!volunteers.length) return null;
  const avgDistance =
    volunteers.reduce((sum, vol) => sum + (Number.isFinite(vol.distanceKm) ? vol.distanceKm : 0), 0) /
    Math.max(1, volunteers.length);
  return Math.max(6, Math.round(8 + avgDistance * 2.8));
};

const compareIncidents = (a, b) => {
  const pDiff = (PRIORITY_SCORE[b.priority] || 0) - (PRIORITY_SCORE[a.priority] || 0);
  if (pDiff !== 0) return pDiff;
  const aEsc = toNumber(a.predictions?.escalationProbability, 0);
  const bEsc = toNumber(b.predictions?.escalationProbability, 0);
  return bEsc - aEsc;
};

/**
 * Auto-respond to crisis by generating assignments for incidents
 * @param {Object} crisisData - Crisis data with incidents, volunteers, resources
 * @returns {Object} Assignments and summary of coordinated response
 */
export function autoRespond(crisisData) {
  const analysis = analyzeCrisisData(crisisData);
  const decisions = [...(analysis.decisions || [])].sort(compareIncidents);
  const volunteerPool = Array.isArray(crisisData?.volunteers)
    ? crisisData.volunteers.map((vol) => ({ ...vol }))
    : [];
  const resourcePool = Array.isArray(crisisData?.resources)
    ? crisisData.resources.map((res) => ({ ...res }))
    : [];

  const assignments = decisions.map((decision) => {
    const requiredSkills = getRequiredSkills(decision.type);
    const recommendedCount = Math.max(
      1,
      Array.isArray(decision.recommendedVolunteers) ? decision.recommendedVolunteers.length : 1
    );
    const selectedVolunteers = findNearestVolunteers(decision, volunteerPool, requiredSkills, recommendedCount);
    selectedVolunteers.forEach((vol) => {
      const idx = volunteerPool.findIndex((candidate) => String(candidate.id) === String(vol.id));
      if (idx >= 0) volunteerPool[idx].available = false;
    });

    const resourceDemand = deriveResourceDemand(decision);
    const allocatedResources = allocateResources(resourceDemand, resourcePool);
    const etaEstimate = estimateEtaMinutes(decision, selectedVolunteers);

    return {
      incidentId: decision.incidentId,
      assignedVolunteers: selectedVolunteers.map((vol) => ({
        id: vol.id,
        name: vol.name || `Volunteer ${vol.id}`,
        skill: vol.skill || (Array.isArray(vol.skills) ? vol.skills.join(', ') : ''),
        distanceKm: Number.isFinite(vol.distanceKm) ? Number(vol.distanceKm.toFixed(2)) : null,
        assignmentScore: Math.round(vol.assignmentScore * 100),
      })),
      allocatedResources,
      priority: decision.priority,
      etaEstimate: etaEstimate == null ? 'N/A' : `${etaEstimate} mins`,
      suggestedAction: decision.suggestedAction,
      riskScore: decision.riskScore,
    };
  });

  const resourcesUsed = assignments.reduce((acc, assignment) => {
    assignment.allocatedResources.forEach((res) => {
      acc[res.type] = (acc[res.type] || 0) + toNumber(res.quantity, 0);
    });
    return acc;
  }, {});

  return {
    assignments,
    summary: {
      totalIncidentsHandled: assignments.length,
      totalVolunteersAssigned: assignments.reduce((sum, item) => sum + item.assignedVolunteers.length, 0),
      resourcesUsed,
      averageResponseTimeMinutes: assignments.length
        ? Math.round(
            assignments.reduce((sum, a) => {
              const eta = parseInt(a.etaEstimate);
              return sum + (Number.isFinite(eta) ? eta : 0);
            }, 0) / assignments.length
          )
        : 0,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Simulate response scenario without committing resources
 * @param {Object} crisisData - Crisis data
 * @returns {Object} Simulated response
 */
export function simulateResponse(crisisData) {
  const response = autoRespond(crisisData);
  
  return {
    ...response,
    simulated: true,
    resourceRequirements: Object.entries(response.summary.resourcesUsed).map(([type, qty]) => ({
      type,
      quantity: qty,
    })),
    volunteerUtilization: {
      assigned: response.summary.totalVolunteersAssigned,
      available: crisisData.volunteers?.length || 0,
      utilizationRate: crisisData.volunteers?.length
        ? Math.round((response.summary.totalVolunteersAssigned / crisisData.volunteers.length) * 100)
        : 0,
    },
  };
}
