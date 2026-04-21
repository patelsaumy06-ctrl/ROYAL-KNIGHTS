import { haversineDistanceKm } from '../../utils/geo';

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

const getPoint = (item) => {
  if (item?.location && Number.isFinite(toNumber(item.location.lat, NaN))) {
    return { lat: toNumber(item.location.lat), lng: toNumber(item.location.lng) };
  }
  if (Number.isFinite(toNumber(item?.lat, NaN)) && Number.isFinite(toNumber(item?.lng, NaN))) {
    return { lat: toNumber(item.lat), lng: toNumber(item.lng) };
  }
  return null;
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
      })),
      allocatedResources,
      priority: decision.priority,
      etaEstimate: etaEstimate == null ? 'N/A' : `${etaEstimate} mins`,
      suggestedAction: decision.suggestedAction,
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
    },
  };
}
