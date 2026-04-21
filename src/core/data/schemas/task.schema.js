/**
 * Task Schema - Data contract for task/need entities
 * 
 * Defines the structure for relief tasks, incidents, and community needs.
 * Supports both simple needs and complex crisis incidents.
 */

/**
 * @typedef {Object} Task
 * @property {string} id - Unique identifier
 * @property {string} category - Task category (medical, flood, rescue, etc.)
 * @property {string} description - Detailed description
 * @property {string} priority - Priority level ('urgent', 'high', 'medium', 'low')
 * @property {string} status - Current status ('open', 'in_progress', 'resolved')
 * @property {Object} location - Geographic location
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {string} [location.label] - Human-readable location
 * @property {string} region - Administrative region
 * @property {number} volunteers - Volunteers needed
 * @property {number} assigned - Volunteers currently assigned
 * @property {string[]} [requiredSkills] - Required volunteer skills
 * @property {number} [affectedPeople] - Number of people affected
 * @property {string} [createdAt] - Creation timestamp (ISO)
 * @property {string} [updatedAt] - Last update timestamp (ISO)
 * @property {Object} [llmInsights] - AI-generated insights
 */

export const TaskSchema = {
  required: ['id', 'category', 'priority', 'location'],
  
  types: {
    id: 'string',
    category: 'string',
    description: 'string',
    priority: 'string',
    status: 'string',
    location: 'object',
    'location.lat': 'number',
    'location.lng': 'number',
    'location.label': 'string',
    region: 'string',
    volunteers: 'number',
    assigned: 'number',
    requiredSkills: 'array',
    affectedPeople: 'number',
    createdAt: 'string',
    updatedAt: 'string',
    llmInsights: 'object',
  },

  defaults: {
    priority: 'medium',
    status: 'open',
    volunteers: 1,
    assigned: 0,
    affectedPeople: 0,
    requiredSkills: [],
    region: 'Unknown',
  },

  enums: {
    priority: ['urgent', 'high', 'medium', 'low'],
    status: ['open', 'in_progress', 'resolved', 'closed'],
  },

  validation: {
    priority: (v) => TaskSchema.enums.priority.includes(v),
    status: (v) => TaskSchema.enums.status.includes(v),
    'location.lat': (v) => v >= -90 && v <= 90,
    'location.lng': (v) => v >= -180 && v <= 180,
    volunteers: (v) => v >= 0,
    assigned: (v) => v >= 0,
  },
};

/**
 * Validate task object against schema
 * @param {Object} data - Task data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateTask(data) {
  const errors = [];
  
  // Check required fields
  TaskSchema.required.forEach((field) => {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check types
  Object.entries(TaskSchema.types).forEach(([path, expectedType]) => {
    const value = path.includes('.') 
      ? path.split('.').reduce((obj, key) => obj?.[key], data)
      : data[path];
    
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== expectedType) {
        errors.push(`Invalid type for ${path}: expected ${expectedType}, got ${actualType}`);
      }
    }
  });

  // Check enums
  Object.entries(TaskSchema.enums).forEach(([field, allowed]) => {
    if (data[field] && !allowed.includes(data[field])) {
      errors.push(`Invalid value for ${field}: must be one of ${allowed.join(', ')}`);
    }
  });

  // Run custom validations
  Object.entries(TaskSchema.validation).forEach(([path, validator]) => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    if (value !== undefined && !validator(value)) {
      errors.push(`Validation failed for ${path}: ${value}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Apply defaults to task data
 * @param {Object} data - Raw task data
 * @returns {Object} Task with defaults applied
 */
export function applyTaskDefaults(data) {
  const now = new Date().toISOString();
  return {
    ...TaskSchema.defaults,
    createdAt: now,
    updatedAt: now,
    ...data,
    requiredSkills: data.requiredSkills || TaskSchema.defaults.requiredSkills,
  };
}

/**
 * Check if task is resolvable (can be marked as resolved)
 * @param {Object} task - Task to check
 * @returns {boolean} Whether task can be resolved
 */
export function isTaskResolvable(task) {
  return task.status !== 'resolved' && task.status !== 'closed';
}

/**
 * Get task progress percentage
 * @param {Object} task - Task to check
 * @returns {number} Progress percentage (0-100)
 */
export function getTaskProgress(task) {
  if (!task.volunteers) return 0;
  return Math.min(100, Math.round((task.assigned / task.volunteers) * 100));
}
