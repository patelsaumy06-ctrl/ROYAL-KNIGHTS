/**
 * Crisis Event Schema - Data contract for crisis/incident entities
 * 
 * Defines the structure for crisis events that require multi-resource coordination.
 * More complex than simple tasks - includes resource requirements and severity metrics.
 */

/**
 * @typedef {Object} CrisisEvent
 * @property {string} id - Unique identifier
 * @property {string} type - Crisis type (flood, fire, medical, rescue, etc.)
 * @property {string} severity - Severity level ('critical', 'high', 'medium', 'low')
 * @property {string} status - Current status
 * @property {Object} location - Geographic location
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {string} location.label - Human-readable location name
 * @property {string} region - Administrative region
 * @property {string} description - Detailed description
 * @property {number} [peopleAffected] - Estimated people affected
 * @property {Object[]} [requiredResources] - Required resources
 * @property {string} createdAt - Creation timestamp (ISO)
 * @property {Object} [llmInsights] - AI-generated insights
 * @property {number} [riskScore] - Calculated risk score (0-100)
 * @property {string} [priority] - Derived priority level
 */

export const CrisisEventSchema = {
  required: ['id', 'type', 'severity', 'location'],
  
  types: {
    id: 'string',
    type: 'string',
    severity: 'string',
    status: 'string',
    location: 'object',
    'location.lat': 'number',
    'location.lng': 'number',
    'location.label': 'string',
    region: 'string',
    description: 'string',
    peopleAffected: 'number',
    requiredResources: 'array',
    createdAt: 'string',
    llmInsights: 'object',
    riskScore: 'number',
    priority: 'string',
  },

  defaults: {
    severity: 'medium',
    status: 'active',
    peopleAffected: 0,
    requiredResources: [],
    region: 'Unknown',
    description: '',
  },

  enums: {
    severity: ['critical', 'high', 'medium', 'low'],
    status: ['active', 'contained', 'resolved', 'escalated'],
    priority: ['critical', 'high', 'medium', 'low'],
  },

  // Incident type categories for resource planning
  categories: {
    natural: ['flood', 'earthquake', 'cyclone', 'drought', 'landslide'],
    medical: ['medical', 'disease_outbreak', 'health_emergency'],
    fire: ['fire', 'wildfire', 'industrial_fire'],
    rescue: ['rescue', 'search_rescue', 'evacuation'],
    infrastructure: ['power_outage', 'water_shortage', 'road_block'],
  },

  validation: {
    severity: (v) => CrisisEventSchema.enums.severity.includes(v),
    status: (v) => CrisisEventSchema.enums.status.includes(v),
    'location.lat': (v) => v >= -90 && v <= 90,
    'location.lng': (v) => v >= -180 && v <= 180,
    riskScore: (v) => v >= 0 && v <= 100,
  },
};

/**
 * Validate crisis event against schema
 * @param {Object} data - Crisis event data
 * @returns {Object} Validation result
 */
export function validateCrisisEvent(data) {
  const errors = [];
  
  // Check required fields
  CrisisEventSchema.required.forEach((field) => {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check types
  Object.entries(CrisisEventSchema.types).forEach(([path, expectedType]) => {
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
  Object.entries(CrisisEventSchema.enums).forEach(([field, allowed]) => {
    if (data[field] && !allowed.includes(data[field])) {
      errors.push(`Invalid value for ${field}: must be one of ${allowed.join(', ')}`);
    }
  });

  // Run custom validations
  Object.entries(CrisisEventSchema.validation).forEach(([path, validator]) => {
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
 * Get crisis category from type
 * @param {string} type - Crisis type
 * @returns {string} Category name
 */
export function getCrisisCategory(type) {
  const normalized = String(type).toLowerCase();
  for (const [category, types] of Object.entries(CrisisEventSchema.categories)) {
    if (types.some((t) => normalized.includes(t))) {
      return category;
    }
  }
  return 'other';
}

/**
 * Check if crisis requires immediate escalation
 * @param {Object} crisis - Crisis event
 * @returns {boolean} Whether to escalate
 */
export function requiresEscalation(crisis) {
  return crisis.severity === 'critical' || 
         (crisis.riskScore && crisis.riskScore >= 80) ||
         (crisis.peopleAffected && crisis.peopleAffected >= 100);
}

/**
 * Apply defaults to crisis event
 * @param {Object} data - Raw crisis data
 * @returns {Object} Crisis with defaults applied
 */
export function applyCrisisDefaults(data) {
  const now = new Date().toISOString();
  return {
    ...CrisisEventSchema.defaults,
    createdAt: now,
    ...data,
    requiredResources: data.requiredResources || CrisisEventSchema.defaults.requiredResources,
  };
}
