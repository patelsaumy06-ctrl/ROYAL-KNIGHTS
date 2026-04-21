/**
 * Core AI System - Production-Grade Humanitarian Response Platform
 * 
 * This module exports all AI/ML engines, pipelines, and orchestration
 * for the ReliefLink platform.
 * 
 * Architecture Layers:
 * - Data Layer: Schemas and models for type safety
 * - Engine Layer: AI/ML engines (matching, prediction, priority, impact, crisis)
 * - Pipeline Layer: Data processing flows
 * - Orchestrator Layer: Central coordination (ResponseEngine)
 * 
 * Design Principles:
 * - Pure functions (no side effects)
 * - No React dependencies
 * - No API calls
 * - Testable and predictable
 * - Modular and extensible
 */

// ============================================================================
// DATA LAYER - Schemas and Models
// ============================================================================

export {
  // Schemas
  VolunteerSchema,
  TaskSchema,
  CrisisEventSchema,
  validateVolunteer,
  validateTask,
  validateCrisisEvent,
  applyVolunteerDefaults,
  applyTaskDefaults,
  applyCrisisDefaults,
  getCrisisCategory,
  requiresEscalation,
  isTaskResolvable,
  getTaskProgress,
} from './data/schemas';

export {
  // Models
  VolunteerModel,
  TaskModel,
  createVolunteer,
  createTask,
  filterAvailable,
  filterBySkill,
  sortByExperience,
  sortByRating,
  enrichVolunteer,
  enrichVolunteers,
  filterByStatus,
  filterByPriority,
  getActiveTasks,
  getTasksNeedingVolunteers,
  sortByCreated,
  sortByUrgency,
  groupByRegion,
  groupByCategory,
  enrichTask,
  enrichTasks,
} from './data/models';

// ============================================================================
// ENGINE LAYER - AI/ML Engines
// ============================================================================

// Matching Engine - Volunteer-to-Task Matching
export {
  rankVolunteersForTask,
  generateVolunteerRecommendations,
  findBestMatch,
  calculateMatch,
  batchCalculateMatches,
  getMatchingStats,
  DEFAULT_WEIGHTS as MATCHING_WEIGHTS,
  calculateSkillScore,
  calculateProximityScore,
  calculateAvailabilityScore,
  calculateExperienceScore,
  calculatePerformanceScore,
  calculateDistanceScore,
  getMatchLabel,
  getMatchQualityLabel,
  calculateCompositeScore,
} from './engines/matching';

// Prediction Engine - Crisis Prediction & Risk Analysis
export {
  predictNeeds,
  detectEmergingCrisis,
  calculateRiskScore,
  analyzeTrend,
} from './engines/prediction';

// Priority Engine - Task Prioritization
export {
  scoreTaskPriority,
  prioritizeTasks,
  getTopUrgentTasks,
  filterByMinPriority,
  groupByPriority,
  getPriorityDistribution,
  reprioritizeWithContext,
} from './engines/priority';

// Impact Engine - Metrics & Analytics
export {
  computeImpactMetrics,
  buildImpactTrend,
  calculateQuickMetrics,
  calculateEfficiencyMetrics,
  calculateVolunteerMetrics,
  generateDashboardMetrics,
} from './engines/impact';

// Crisis Intelligence Engine - Crisis Analysis & Auto-Response
export {
  analyzeCrisisData,
  getCrisisSummary,
} from './engines/crisis-intelligence/analyzer';

export {
  autoRespond,
  simulateResponse,
} from './engines/crisis-intelligence/autoResponse';

// ============================================================================
// PIPELINE LAYER - Data Processing Flows
// ============================================================================

export {
  executeCrisisPipeline,
  quickAnalyze,
  processCrisisUpdate,
} from './pipelines/crisisPipeline';

export {
  executeResponsePipeline,
  batchProcessAssignments,
  reevaluateAssignments,
} from './pipelines/responsePipeline';

// ============================================================================
// ORCHESTRATOR LAYER - Central Coordination
// ============================================================================

export {
  ResponseEngine,
  createResponseEngine,
  getGlobalEngine,
} from './orchestrator/responseEngine';

// ============================================================================
// LEGACY EXPORTS - Backward Compatibility
// ============================================================================

// Keep old crisis exports for backward compatibility
export { analyzeCrisisData as analyzeCrisisLegacy } from './engines/crisis-intelligence/analyzer';
export { autoRespond as autoRespondLegacy } from './engines/crisis-intelligence/autoResponse';
