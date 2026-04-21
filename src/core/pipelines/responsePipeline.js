/**
 * Response Pipeline - End-to-End Response Coordination
 * 
 * Orchestrates the full response flow:
 * Prediction → Priority → Matching → Assignment
 * 
 * @module ResponsePipeline
 */

import { predictNeeds, detectEmergingCrisis } from '../engines/prediction';
import { prioritizeTasks, getTopUrgentTasks } from '../engines/priority';
import {
  rankVolunteersForTask,
  rankVolunteersWithAI,
  generateRecommendations as generateVolunteerRecommendations,
} from '../engines/matching';
import { computeImpactMetrics } from '../engines/impact';

/**
 * Pipeline configuration
 */
const DEFAULT_CONFIG = {
  maxTasksPerBatch: 10,
  minMatchScore: 40,
  autoAssignThreshold: 85,
  enablePredictions: true,
  enableAutoAssign: false,
};

/**
 * Execute the full response pipeline
 * @param {Object} data - Input data
 * @param {Object} config - Pipeline configuration
 * @returns {Object} Pipeline result
 */
export function executeResponsePipeline(data, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  
  const { tasks = [], volunteers = [], reports = [], notifications = [] } = data;
  
  const result = {
    timestamp: new Date().toISOString(),
    config: cfg,
    stages: {},
    assignments: [],
    metrics: {},
    duration: 0,
  };

  // Stage 1: Prediction
  const predictions = cfg.enablePredictions
    ? predictNeeds(reports)
    : [];
  
  const crisisAlerts = cfg.enablePredictions
    ? detectEmergingCrisis(tasks, notifications)
    : [];

  result.stages.prediction = {
    predictions,
    crisisAlerts,
    predictedRegions: predictions.map((p) => p.region),
  };

  // Stage 2: Prioritization
  const prioritizedTasks = prioritizeTasks(tasks);
  const urgentTasks = getTopUrgentTasks(prioritizedTasks, cfg.maxTasksPerBatch);

  result.stages.prioritization = {
    totalTasks: tasks.length,
    prioritizedCount: prioritizedTasks.length,
    urgentTasks: urgentTasks.map((t) => ({
      id: t.id,
      priorityScore: t.priorityScore,
      priorityLabel: t.priorityLabel,
    })),
  };

  // Stage 3: Matching
  const matches = urgentTasks.map((task) => {
    const ranked = rankVolunteersForTask(task, volunteers, {
      availableOnly: true,
    });
    
    const viableMatches = ranked.filter((v) => v.matchScore >= cfg.minMatchScore);
    const topMatch = viableMatches[0] || null;
    const shouldAutoAssign = topMatch && topMatch.matchScore >= cfg.autoAssignThreshold && cfg.enableAutoAssign;

    return {
      taskId: task.id,
      taskPriority: task.priorityScore,
      topMatch: topMatch
        ? {
            volunteerId: topMatch.id,
            volunteerName: topMatch.name,
            matchScore: topMatch.matchScore,
            distanceKm: topMatch.distanceKm,
          }
        : null,
      viableMatches: viableMatches.length,
      recommendedVolunteers: viableMatches.slice(0, 3).map((v) => ({
        id: v.id,
        name: v.name,
        matchScore: v.matchScore,
      })),
      autoAssigned: shouldAutoAssign,
    };
  });

  result.stages.matching = {
    tasksProcessed: matches.length,
    matchesWithViableOptions: matches.filter((m) => m.viableMatches > 0).length,
    autoAssignments: matches.filter((m) => m.autoAssigned).length,
  };

  // Stage 4: Assignment Generation
  result.assignments = matches
    .filter((m) => m.topMatch)
    .map((m) => ({
      taskId: m.taskId,
      volunteerId: m.topMatch.volunteerId,
      volunteerName: m.topMatch.volunteerName,
      matchScore: m.topMatch.matchScore,
      status: m.autoAssigned ? 'auto_assigned' : 'recommended',
      timestamp: new Date().toISOString(),
    }));

  // Stage 5: Impact Metrics
  result.metrics = computeImpactMetrics(tasks, volunteers, predictions);

  // Finalize
  result.duration = Date.now() - startTime;
  result.summary = {
    totalTasks: tasks.length,
    tasksWithMatches: result.assignments.length,
    autoAssigned: result.assignments.filter((a) => a.status === 'auto_assigned').length,
    averageMatchScore: result.assignments.length
      ? Math.round(
          result.assignments.reduce((sum, a) => sum + a.matchScore, 0) / result.assignments.length
        )
      : 0,
    predictionsGenerated: predictions.length,
    crisisAlerts: crisisAlerts.length,
  };

  return result;
}

/**
 * Batch process multiple task assignments
 * @param {Array} tasks - Tasks to process
 * @param {Array} volunteers - Available volunteers
 * @param {Object} options - Processing options
 * @returns {Object} Batch result
 */
export function batchProcessAssignments(tasks, volunteers, options = {}) {
  const recommendations = generateVolunteerRecommendations(
    tasks,
    volunteers,
    options.autoAssign || false
  );

  return {
    timestamp: new Date().toISOString(),
    taskCount: tasks.length,
    recommendations: recommendations.map((rec) => ({
      taskId: rec.taskId,
      assigned: rec.autoAssigned,
      assignedVolunteerId: rec.assignedVolunteerId,
      topCandidates: rec.rankedVolunteers.slice(0, 3),
      summary: rec.recommendationSummary,
    })),
    summary: {
      totalRecommendations: recommendations.length,
      autoAssigned: recommendations.filter((r) => r.autoAssigned).length,
      tasksWithMatches: recommendations.filter((r) => r.rankedVolunteers.length > 0).length,
    },
  };
}

/**
 * Re-evaluate assignments when conditions change
 * @param {Array} currentAssignments - Current assignments
 * @param {Object} changes - What changed (new tasks, volunteer updates, etc.)
 * @returns {Object} Re-evaluation result
 */
export function reevaluateAssignments(currentAssignments, changes) {
  const affectedAssignments = currentAssignments.filter((a) => {
    // Check if task was updated
    if (changes.updatedTasks?.some((t) => t.id === a.taskId)) return true;
    // Check if volunteer is no longer available
    if (changes.unavailableVolunteers?.includes(a.volunteerId)) return true;
    return false;
  });

  const recommendations = affectedAssignments.map((assignment) => ({
    originalAssignment: assignment,
    action: changes.unavailableVolunteers?.includes(assignment.volunteerId)
      ? 'reassign_required'
      : 'review_recommended',
    reason: changes.unavailableVolunteers?.includes(assignment.volunteerId)
      ? 'Volunteer no longer available'
      : 'Task parameters changed',
  }));

  return {
    timestamp: new Date().toISOString(),
    totalAssignments: currentAssignments.length,
    affectedCount: affectedAssignments.length,
    recommendations,
    unaffectedCount: currentAssignments.length - affectedAssignments.length,
  };
}
