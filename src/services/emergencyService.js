/**
 * Emergency Mode Service — Intelligent Response Orchestration
 *
 * Orchestrates the full emergency activation pipeline:
 *   1. Fetch & aggregate unresolved tasks + available volunteers
 *   2. Smart prioritization (severity → distance → wait time)
 *   3. Auto-assign nearest qualified volunteers
 *   4. Generate notification payloads
 *   5. Compute critical zone map data
 *   6. Track all actions in an activity log
 *
 * Fallback: If any step fails, returns partial data with `limitedData: true`.
 */

import { api } from './api';
import { addNeed } from './firestoreRealtime';
import {
  prioritizeTasks,
  rankVolunteersForTask,
  scoreTaskPriority,
} from '../core';
import { haversineKm } from '../utils/geo';

// ─── Helpers ────────────────────────────────────────────────────

const timestamp = () => new Date().toISOString();

const logEntry = (action, detail = '') => ({
  time: timestamp(),
  action,
  detail,
});

/**
 * Estimate ETA in minutes based on distance (km).
 * Assumes average emergency response speed of ~40 km/h.
 */
const estimateETA = (distanceKm) => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 5;
  return Math.max(3, Math.round((distanceKm / 40) * 60));
};

// ─── 1. Fetch Emergency Data ────────────────────────────────────

export async function fetchEmergencyData() {
  const logs = [];
  logs.push(logEntry('FETCH_START', 'Gathering emergency data…'));

  let needs = [];
  let volunteers = [];

  try {
    needs = await api.getNeeds();
    if (!Array.isArray(needs)) needs = [];
    logs.push(logEntry('FETCH_NEEDS', `${needs.length} total tasks loaded`));
  } catch (err) {
    console.warn('[EmergencyService] Needs fetch failed, using cache', err);
    const cached = api.cached();
    needs = cached?.needs || [];
    logs.push(logEntry('FETCH_NEEDS_FALLBACK', `Using ${needs.length} cached tasks`));
  }

  try {
    volunteers = await api.getVolunteers();
    if (!Array.isArray(volunteers)) volunteers = [];
    logs.push(logEntry('FETCH_VOLUNTEERS', `${volunteers.length} volunteers loaded`));
  } catch (err) {
    console.warn('[EmergencyService] Volunteers fetch failed, using cache', err);
    const cached = api.cached();
    volunteers = cached?.volunteers || [];
    logs.push(logEntry('FETCH_VOLUNTEERS_FALLBACK', `Using ${volunteers.length} cached volunteers`));
  }

  const unresolved = needs.filter((n) => n.status !== 'resolved');
  const available = volunteers.filter((v) => v.available !== false);

  logs.push(logEntry('FETCH_COMPLETE', `${unresolved.length} unresolved, ${available.length} available volunteers`));

  return { needs, unresolved, volunteers, available, logs };
}

// ─── 2. Smart Prioritization ────────────────────────────────────

export function prioritizeEmergencyTasks(unresolvedTasks, referencePoint = null) {
  const logs = [];
  logs.push(logEntry('PRIORITIZE_START', `Scoring ${unresolvedTasks.length} tasks`));

  // Use core priority engine first
  let scored = [];
  try {
    scored = prioritizeTasks(unresolvedTasks);
  } catch {
    // Fallback: manual scoring
    scored = unresolvedTasks.map((t) => ({
      ...t,
      priorityScore: scoreTaskPriority?.(t)?.score ?? 0,
    }));
  }

  // Enrich with distance + wait time weighting
  const now = Date.now();
  scored = scored.map((task) => {
    const severityWeight = task.priority === 'urgent' ? 100 : task.priority === 'medium' ? 60 : 30;

    // Time waiting (hours since creation / deadline)
    const createdMs = task.timestamp?.toMillis?.() ?? task.timestamp ?? now;
    const waitHours = Math.max(0, (now - createdMs) / 3600000);
    const waitWeight = Math.min(40, waitHours * 5);

    // Distance from reference (if provided)
    let distanceWeight = 0;
    if (referencePoint && task.lat != null && task.lng != null) {
      const dist = haversineKm(referencePoint.lat, referencePoint.lng, task.lat, task.lng);
      distanceWeight = Math.max(0, 30 - dist); // closer = higher score
    }

    const emergencyScore = severityWeight + waitWeight + distanceWeight + (task.priorityScore || 0) * 0.5;

    return { ...task, emergencyScore, severityWeight, waitWeight, distanceWeight };
  });

  // Sort descending by emergency score
  scored.sort((a, b) => b.emergencyScore - a.emergencyScore);

  logs.push(logEntry('PRIORITIZE_COMPLETE', `Top task: ${scored[0]?.category || 'none'} (score: ${scored[0]?.emergencyScore?.toFixed(1) || 0})`));

  return { prioritized: scored, logs };
}

// ─── 3. Auto-Assign Volunteers ──────────────────────────────────

export function autoAssignVolunteers(prioritizedTasks, availableVolunteers, maxAssignments = 5) {
  const logs = [];
  const assignments = [];
  const usedVolunteerIds = new Set();

  logs.push(logEntry('ASSIGN_START', `Matching ${Math.min(prioritizedTasks.length, maxAssignments)} tasks with ${availableVolunteers.length} volunteers`));

  const tasksToAssign = prioritizedTasks.slice(0, maxAssignments);

  for (const task of tasksToAssign) {
    // Filter out already-assigned volunteers
    const pool = availableVolunteers.filter((v) => !usedVolunteerIds.has(v.id));
    if (pool.length === 0) {
      logs.push(logEntry('ASSIGN_SKIP', `No available volunteers for "${task.category}"`));
      break;
    }

    // Try core matching engine first
    let bestMatch = null;
    try {
      const matchResult = rankVolunteersForTask(task, pool);
      // Handle both return formats: engines returns { ranked }, legacy returns array
      const ranked = Array.isArray(matchResult) ? matchResult : matchResult?.ranked;
      if (Array.isArray(ranked) && ranked.length > 0) {
        bestMatch = ranked[0];
      }
    } catch {
      // Fallback: nearest by distance
    }

    // Fallback: find nearest volunteer by haversine
    if (!bestMatch && task.lat != null && task.lng != null) {
      let nearestDist = Infinity;
      for (const vol of pool) {
        if (vol.lat == null || vol.lng == null) continue;
        const dist = haversineKm(task.lat, task.lng, vol.lat, vol.lng);
        if (dist < nearestDist) {
          nearestDist = dist;
          bestMatch = { ...vol, distanceKm: dist };
        }
      }
    }

    // Last resort: just pick first available
    if (!bestMatch && pool.length > 0) {
      bestMatch = pool[0];
    }

    if (bestMatch) {
      const distKm = bestMatch.distanceKm ??
        (task.lat != null && bestMatch.lat != null
          ? haversineKm(task.lat, task.lng, bestMatch.lat, bestMatch.lng)
          : null);

      const eta = estimateETA(distKm);

      const assignment = {
        task: {
          id: task.id,
          category: task.category,
          location: task.location,
          region: task.region,
          priority: task.priority,
          lat: task.lat,
          lng: task.lng,
          emergencyScore: task.emergencyScore,
        },
        volunteer: {
          id: bestMatch.id,
          name: bestMatch.name,
          skill: bestMatch.skill,
          lat: bestMatch.lat,
          lng: bestMatch.lng,
        },
        distanceKm: distKm,
        etaMinutes: eta,
        assignedAt: timestamp(),
      };

      assignments.push(assignment);
      usedVolunteerIds.add(bestMatch.id);

      const distLabel = Number.isFinite(distKm) ? `${distKm.toFixed(1)}km` : 'nearby';
      logs.push(logEntry('ASSIGNED', `${bestMatch.name} → "${task.category}" at ${task.location} (${distLabel}, ETA ~${eta}min)`));
    }
  }

  logs.push(logEntry('ASSIGN_COMPLETE', `${assignments.length} volunteers dispatched`));

  return { assignments, logs };
}

// ─── 4. Generate Alert Payloads ─────────────────────────────────

export function generateEmergencyAlerts(assignments) {
  const logs = [];
  const alerts = [];

  for (const a of assignments) {
    alerts.push({
      id: Date.now() + Math.random(),
      type: 'urgent',
      title: `🚨 Emergency Assignment: ${a.task.category}`,
      body: `You have been assigned to a critical task at ${a.task.location}. ETA: ~${a.etaMinutes} min.`,
      volunteerId: a.volunteer.id,
      volunteerName: a.volunteer.name,
      taskId: a.task.id,
      time: 'Just now',
      read: false,
      createdAt: timestamp(),
    });

    logs.push(logEntry('ALERT_SENT', `Alert dispatched to ${a.volunteer.name}`));
  }

  return { alerts, logs };
}

// ─── 5. Compute Critical Zones ──────────────────────────────────

export function highlightCriticalZones(unresolvedTasks) {
  const logs = [];
  const zoneMap = new Map();

  for (const task of unresolvedTasks) {
    const key = task.region || task.location || 'Unknown';
    const existing = zoneMap.get(key) || {
      region: key,
      lat: task.lat,
      lng: task.lng,
      severity: 'low',
      taskCount: 0,
      urgentCount: 0,
      tasks: [],
    };

    existing.taskCount++;
    if (task.priority === 'urgent') existing.urgentCount++;
    existing.tasks.push({
      id: task.id,
      category: task.category,
      priority: task.priority,
    });

    // Determine zone severity color
    if (existing.urgentCount >= 2 || existing.taskCount >= 5) {
      existing.severity = 'critical';  // Red pulsing
      existing.color = '#EF4444';
    } else if (existing.urgentCount >= 1 || existing.taskCount >= 3) {
      existing.severity = 'high';      // Yellow
      existing.color = '#F59E0B';
    } else {
      existing.severity = 'moderate';   // Orange
      existing.color = '#FB923C';
    }

    zoneMap.set(key, existing);
  }

  const zones = [...zoneMap.values()].sort((a, b) => b.urgentCount - a.urgentCount || b.taskCount - a.taskCount);

  logs.push(logEntry('ZONES_COMPUTED', `${zones.length} critical zones identified, ${zones.filter(z => z.severity === 'critical').length} at critical level`));

  return { zones, logs };
}

// ─── 6. Master Activation Function ──────────────────────────────

export async function activateFullEmergencyMode() {
  const allLogs = [];
  let limitedData = false;

  allLogs.push(logEntry('EMERGENCY_ACTIVATE', '🚨 Emergency Mode activation initiated'));

  // Step 1: Fetch data
  let fetchResult;
  try {
    fetchResult = await fetchEmergencyData();
    allLogs.push(...fetchResult.logs);
  } catch (err) {
    console.error('[EmergencyService] Critical fetch failure', err);
    allLogs.push(logEntry('FETCH_FAILED', '⚠️ Data fetch failed — using limited mode'));
    limitedData = true;
    fetchResult = { needs: [], unresolved: [], volunteers: [], available: [] };
  }

  // Step 2: Also trigger the existing api.activateEmergencyMode() for Firestore persistence
  let apiResult = null;
  try {
    apiResult = await api.activateEmergencyMode();
    allLogs.push(logEntry('API_DISPATCH', `Core emergency dispatched: ${apiResult?.volunteer?.name || 'N/A'}`));

    // Write emergency task to Firestore incidents subcollection so it appears on the Tasks page
    const ngoEmail = localStorage.getItem('Needlink_current_ngo_email');
    if (ngoEmail && apiResult?.need) {
      try {
        const incidentData = {
          category: apiResult.need.category || 'Emergency Response',
          location: apiResult.need.location || 'Emergency Zone',
          region: apiResult.need.region || 'Unknown',
          priority: 'urgent',
          status: 'active',
          volunteers: apiResult.need.volunteers || 8,
          assigned: 1,
          deadline: apiResult.need.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          lat: apiResult.need.lat,
          lng: apiResult.need.lng,
          reportText: `🚨 Emergency task auto-created. Volunteer ${apiResult.volunteer?.name || 'N/A'} assigned.`,
        };
        await addNeed(ngoEmail, incidentData);
        allLogs.push(logEntry('TASK_CREATED', `Emergency task added to Tasks: "${incidentData.category}" at ${incidentData.location}`));
      } catch (writeErr) {
        console.warn('[EmergencyService] Failed to write incident to Firestore', writeErr);
        allLogs.push(logEntry('TASK_CREATE_WARN', '⚠️ Task created in cache but Firestore write failed'));
      }
    }
  } catch (err) {
    console.warn('[EmergencyService] Core API dispatch failed', err);
    allLogs.push(logEntry('API_DISPATCH_FALLBACK', '⚠️ Core dispatch failed — continuing with local assignment'));
    limitedData = true;
  }

  // Step 3: Smart prioritization
  const { prioritized, logs: priorityLogs } = prioritizeEmergencyTasks(fetchResult.unresolved);
  allLogs.push(...priorityLogs);

  // Step 4: Auto-assign volunteers
  const { assignments, logs: assignLogs } = autoAssignVolunteers(prioritized, fetchResult.available);
  allLogs.push(...assignLogs);

  // Step 5: Generate alerts
  const { alerts, logs: alertLogs } = generateEmergencyAlerts(assignments);
  allLogs.push(...alertLogs);

  // Step 6: Compute critical zones
  const { zones, logs: zoneLogs } = highlightCriticalZones(fetchResult.unresolved);
  allLogs.push(...zoneLogs);

  // Build stats
  const stats = {
    totalIncidents: fetchResult.unresolved.length,
    criticalZones: zones.filter((z) => z.severity === 'critical').length,
    volunteersDispatched: assignments.length,
    averageETA: assignments.length > 0
      ? Math.round(assignments.reduce((sum, a) => sum + a.etaMinutes, 0) / assignments.length)
      : 0,
    totalVolunteersAvailable: fetchResult.available.length,
  };

  allLogs.push(logEntry('EMERGENCY_ACTIVE', `✅ Emergency Mode fully active — ${assignments.length} dispatched, ${zones.length} zones monitored`));

  return {
    success: true,
    limitedData,
    assignments,
    alerts,
    zones,
    stats,
    prioritizedTasks: prioritized.slice(0, 10),
    apiResult,
    logs: allLogs,
    activatedAt: timestamp(),
  };
}
