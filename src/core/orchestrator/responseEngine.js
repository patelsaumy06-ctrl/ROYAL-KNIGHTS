/**
 * Response Engine - Central Coordination System
 * 
 * The Response Engine orchestrates all AI engines to provide intelligent crisis response coordination.
 * 
 * @module ResponseEngine
 */

import { executeCrisisPipeline, quickAnalyze } from '../pipelines/crisisPipeline';
import { executeResponsePipeline, batchProcessAssignments } from '../pipelines/responsePipeline';
import { predictNeeds, detectEmergingCrisis } from '../engines/prediction';
import { prioritizeTasks } from '../engines/priority';
import { findBestMatch } from '../engines/matching';
import { generateDashboardMetrics } from '../engines/impact';
import { simulateResponse } from '../engines/crisis-intelligence/autoResponse';

/**
 * Response Engine - Main orchestrator class
 */
export class ResponseEngine {
  constructor(config = {}) {
    this.config = {
      enableAutoAssign: false,
      minMatchScore: 50,
      maxRecommendations: 5,
      enablePredictions: true,
      ...config,
    };
    this.state = {
      isProcessing: false,
      lastRun: null,
      history: [],
    };
  }

  /**
   * Process a crisis situation end-to-end
   * @param {Object} crisisData - Crisis data with incidents, volunteers, resources
   * @param {Object} options - Processing options
   * @returns {Object} Complete response plan
   */
  processCrisis(crisisData, options = {}) {
    this.state.isProcessing = true;
    const startTime = Date.now();

    try {
      const pipelineResult = executeCrisisPipeline(crisisData, {
        simulate: !options.execute,
        ...options,
      });

      const result = {
        success: pipelineResult.success,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        crisis: {
          summary: pipelineResult.results.summary,
          analysis: pipelineResult.results.analysis,
        },
        response: pipelineResult.results.response,
        plan: this._generateActionPlan(pipelineResult),
        metadata: {
          stages: Object.keys(pipelineResult.results),
          warnings: pipelineResult.warnings.length,
          errors: pipelineResult.errors.length,
        },
      };

      this._updateHistory('crisis', result);
      return result;
    } finally {
      this.state.isProcessing = false;
      this.state.lastRun = new Date().toISOString();
    }
  }

  /**
   * Coordinate volunteer assignments for tasks
   * @param {Object} data - Tasks and volunteers data
   * @returns {Object} Coordination result
   */
  coordinateAssignments(data) {
    return executeResponsePipeline(data, {
      enableAutoAssign: this.config.enableAutoAssign,
      minMatchScore: this.config.minMatchScore,
      maxTasksPerBatch: this.config.maxRecommendations,
      enablePredictions: this.config.enablePredictions,
    });
  }

  /**
   * Get real-time dashboard metrics
   * @param {Object} data - Current system data
   * @returns {Object} Dashboard metrics
   */
  getDashboardMetrics(data) {
    return generateDashboardMetrics(data);
  }

  /**
   * Predict emerging needs and risks
   * @param {Object} context - Current context data
   * @returns {Object} Predictions and alerts
   */
  predict(context) {
    const { reports = [], tasks = [], notifications = [] } = context;

    const predictions = this.config.enablePredictions ? predictNeeds(reports) : [];
    const crisisAlerts = this.config.enablePredictions ? detectEmergingCrisis(tasks, notifications) : [];

    return {
      timestamp: new Date().toISOString(),
      predictions,
      crisisAlerts,
      riskLevel: this._calculateRiskLevel(predictions, crisisAlerts),
    };
  }

  /**
   * Find best volunteer for a specific task
   * @param {Object} task - Task requirements
   * @param {Array} volunteers - Available volunteers
   * @returns {Object} Best match result
   */
  findBestVolunteer(task, volunteers) {
    const match = findBestMatch(task, volunteers);
    
    if (!match) {
      return { found: false, reason: 'No suitable volunteers found' };
    }

    return {
      found: true,
      volunteer: {
        id: match.id,
        name: match.name,
        matchScore: match.matchScore,
      },
      confidence: match.matchScore >= 80 ? 'high' : match.matchScore >= 60 ? 'medium' : 'low',
    };
  }

  /**
   * Simulate a response scenario
   * @param {Object} scenario - Scenario data
   * @returns {Object} Simulation result
   */
  simulate(scenario) {
    return simulateResponse(scenario);
  }

  /**
   * Quick analysis without full processing
   * @param {Object} data - Input data
   * @returns {Object} Quick analysis
   */
  quickAnalyze(data) {
    return quickAnalyze(data);
  }

  /**
   * Get engine status and health
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      status: this.state.isProcessing ? 'processing' : 'ready',
      config: this.config,
      state: {
        isProcessing: this.state.isProcessing,
        lastRun: this.state.lastRun,
        historyCount: this.state.history.length,
      },
    };
  }

  _generateActionPlan(pipelineResult) {
    const { response } = pipelineResult.results;
    if (!response) return null;

    return {
      immediate: response.assignments.filter((a) => a.priority === 'high'),
      scheduled: response.assignments.filter((a) => a.priority !== 'high'),
      resources: response.summary.resourcesUsed,
    };
  }

  _calculateRiskLevel(predictions, alerts) {
    const criticalPredictions = predictions.filter((p) => p.urgencyLevel === 'critical').length;
    const criticalAlerts = alerts.filter((a) => a.urgencyLevel === 'critical').length;

    if (criticalAlerts > 0 || criticalPredictions > 2) return 'critical';
    if (alerts.length > 0 || predictions.length > 3) return 'elevated';
    if (predictions.length > 0) return 'moderate';
    return 'low';
  }

  _updateHistory(type, result) {
    this.state.history.push({
      type,
      timestamp: result.timestamp,
      duration: result.duration,
      success: result.success,
    });

    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
  }
}

/**
 * Create a new Response Engine instance
 * @param {Object} config - Engine configuration
 * @returns {ResponseEngine}
 */
export function createResponseEngine(config = {}) {
  return new ResponseEngine(config);
}

let globalEngine = null;

/**
 * Get or create global engine instance
 * @param {Object} config - Configuration (only used on first call)
 * @returns {ResponseEngine}
 */
export function getGlobalEngine(config = {}) {
  if (!globalEngine) {
    globalEngine = new ResponseEngine(config);
  }
  return globalEngine;
}
