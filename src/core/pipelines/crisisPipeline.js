/**
 * Crisis Pipeline - Data Processing Flow for Crisis Events
 * 
 * Processes incoming crisis data through validation, enrichment,
 * analysis, and response generation stages.
 * 
 * @module CrisisPipeline
 */

import { validateCrisisEvent, applyCrisisDefaults } from '../data/schemas/crisisEvent.schema';
import { analyzeCrisisData, getCrisisSummary } from '../engines/crisis-intelligence/analyzer';
import { autoRespond, simulateResponse } from '../engines/crisis-intelligence/autoResponse';

/**
 * Pipeline context for tracking processing state
 */
class PipelineContext {
  constructor(input) {
    this.input = input;
    this.data = null;
    this.errors = [];
    this.warnings = [];
    this.stage = 'initialized';
    this.results = {};
    this.timestamp = new Date().toISOString();
  }

  addError(stage, message) {
    this.errors.push({ stage, message, timestamp: new Date().toISOString() });
  }

  addWarning(stage, message) {
    this.warnings.push({ stage, message, timestamp: new Date().toISOString() });
  }

  setStage(stage) {
    this.stage = stage;
  }

  setResult(key, value) {
    this.results[key] = value;
  }

  isValid() {
    return this.errors.length === 0;
  }
}

/**
 * Stage 1: Validate and normalize incoming crisis data
 * @param {PipelineContext} ctx - Pipeline context
 * @returns {PipelineContext}
 */
function validateStage(ctx) {
  ctx.setStage('validation');
  
  if (!ctx.input) {
    ctx.addError('validation', 'No input data provided');
    return ctx;
  }

  const { incidents = [], volunteers = [], resources = [] } = ctx.input;

  // Validate incidents
  const validatedIncidents = incidents.map((incident) => {
    const withDefaults = applyCrisisDefaults(incident);
    const validation = validateCrisisEvent(withDefaults);
    
    if (!validation.valid) {
      ctx.addWarning('validation', `Incident ${incident.id}: ${validation.errors.join(', ')}`);
    }
    
    return withDefaults;
  });

  ctx.data = {
    incidents: validatedIncidents,
    volunteers: volunteers || [],
    resources: resources || [],
  };

  ctx.setResult('validatedIncidents', validatedIncidents.length);
  ctx.setResult('validationWarnings', ctx.warnings.length);

  return ctx;
}

/**
 * Stage 2: Enrich data with computed fields
 * @param {PipelineContext} ctx - Pipeline context
 * @returns {PipelineContext}
 */
function enrichStage(ctx) {
  ctx.setStage('enrichment');
  
  if (!ctx.isValid()) return ctx;

  // Calculate aggregate metrics
  const { incidents, volunteers, resources } = ctx.data;
  
  const enrichment = {
    totalPeopleAffected: incidents.reduce((sum, i) => sum + (i.peopleAffected || 0), 0),
    criticalCount: incidents.filter((i) => i.severity === 'critical').length,
    availableVolunteers: volunteers.filter((v) => v.available !== false).length,
    availableResources: resources.filter((r) => r.availability !== false).length,
    geographicSpread: new Set(incidents.map((i) => i.region)).size,
  };

  ctx.data._enrichment = enrichment;
  ctx.setResult('enrichment', enrichment);

  return ctx;
}

/**
 * Stage 3: Analyze crisis data
 * @param {PipelineContext} ctx - Pipeline context
 * @returns {PipelineContext}
 */
function analyzeStage(ctx) {
  ctx.setStage('analysis');
  
  if (!ctx.isValid()) return ctx;

  try {
    const analysis = analyzeCrisisData(ctx.data);
    ctx.data._analysis = analysis;
    ctx.setResult('analysis', analysis);
    ctx.setResult('summary', getCrisisSummary(analysis));
  } catch (error) {
    ctx.addError('analysis', error.message);
  }

  return ctx;
}

/**
 * Stage 4: Generate response plan
 * @param {PipelineContext} ctx - Pipeline context
 * @param {Object} options - Response options
 * @returns {PipelineContext}
 */
function responseStage(ctx, options = {}) {
  ctx.setStage('response');
  
  if (!ctx.isValid() || !ctx.data._analysis) return ctx;

  try {
    const response = options.simulate 
      ? simulateResponse(ctx.data)
      : autoRespond(ctx.data);
    
    ctx.data._response = response;
    ctx.setResult('response', response);
    ctx.setResult('simulated', !!options.simulate);
  } catch (error) {
    ctx.addError('response', error.message);
  }

  return ctx;
}

/**
 * Execute the full crisis pipeline
 * @param {Object} input - Crisis input data
 * @param {Object} options - Pipeline options
 * @returns {Object} Pipeline result
 */
export function executeCrisisPipeline(input, options = {}) {
  const ctx = new PipelineContext(input);

  // Execute stages
  validateStage(ctx);
  enrichStage(ctx);
  analyzeStage(ctx);
  responseStage(ctx, options);

  ctx.setStage('completed');

  return {
    success: ctx.isValid(),
    stage: ctx.stage,
    timestamp: ctx.timestamp,
    data: ctx.data,
    results: ctx.results,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

/**
 * Quick analysis without full response generation
 * @param {Object} input - Crisis input data
 * @returns {Object} Analysis result
 */
export function quickAnalyze(input) {
  const ctx = new PipelineContext(input);
  
  validateStage(ctx);
  enrichStage(ctx);
  analyzeStage(ctx);

  return {
    success: ctx.isValid(),
    summary: ctx.results.summary,
    analysis: ctx.results.analysis,
    enrichment: ctx.results.enrichment,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

/**
 * Stream processing for real-time crisis updates
 * @param {Object} currentState - Current crisis state
 * @param {Object} update - New update data
 * @returns {Object} Updated state
 */
export function processCrisisUpdate(currentState, update) {
  // Merge new incidents with existing
  const existingIds = new Set(currentState.incidents?.map((i) => i.id) || []);
  const newIncidents = (update.incidents || []).filter((i) => !existingIds.has(i.id));
  
  // Update existing incidents if changed
  const updatedIncidents = (currentState.incidents || []).map((incident) => {
    const updateIncident = (update.incidents || []).find((i) => i.id === incident.id);
    return updateIncident ? { ...incident, ...updateIncident, updatedAt: new Date().toISOString() } : incident;
  });

  const mergedState = {
    ...currentState,
    incidents: [...updatedIncidents, ...newIncidents],
    volunteers: update.volunteers || currentState.volunteers || [],
    resources: update.resources || currentState.resources || [],
    lastUpdate: new Date().toISOString(),
  };

  // Re-run analysis
  return quickAnalyze(mergedState);
}
