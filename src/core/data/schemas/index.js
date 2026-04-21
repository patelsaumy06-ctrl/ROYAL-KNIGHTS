/**
 * Schema Index - Central export for all data schemas
 * 
 * Provides a unified interface for data validation and schema management
 * across the ReliefLink platform.
 */

export {
  VolunteerSchema,
  validateVolunteer,
  applyVolunteerDefaults,
} from './volunteer.schema';

export {
  TaskSchema,
  validateTask,
  applyTaskDefaults,
  isTaskResolvable,
  getTaskProgress,
} from './task.schema';

export {
  CrisisEventSchema,
  validateCrisisEvent,
  getCrisisCategory,
  requiresEscalation,
  applyCrisisDefaults,
} from './crisisEvent.schema';

/**
 * Schema registry for dynamic access
 */
export const SchemaRegistry = {
  volunteer: () => import('./volunteer.schema'),
  task: () => import('./task.schema'),
  crisisEvent: () => import('./crisisEvent.schema'),
};

/**
 * Validate any entity against its schema
 * @param {string} entityType - Type of entity ('volunteer', 'task', 'crisisEvent')
 * @param {Object} data - Data to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateEntity(entityType, data) {
  const module = await SchemaRegistry[entityType]();
  const validator = module[`validate${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`];
  return validator ? validator(data) : { valid: false, errors: ['Unknown entity type'] };
}
