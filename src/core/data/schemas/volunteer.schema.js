/**
 * Volunteer Schema - Data contract for volunteer entities
 * 
 * This schema defines the structure and validation for volunteer data
 * across the ReliefLink platform. Used for type safety and data integrity.
 */

/**
 * @typedef {Object} Volunteer
 * @property {string} id - Unique identifier
 * @property {string} name - Full name
 * @property {string} email - Contact email
 * @property {string} phone - Contact phone
 * @property {string} skill - Primary skill/specialization
 * @property {string[]} [skills] - Additional skills array
 * @property {Object} location - Geographic location
 * @property {number} location.lat - Latitude
 * @property {number} location.lng - Longitude
 * @property {string} [location.label] - Human-readable location name
 * @property {string} region - Administrative region
 * @property {boolean} available - Current availability status
 * @property {string} [status] - Detailed status ('available', 'busy', 'soon')
 * @property {number} tasks - Completed task count
 * @property {number} rating - Performance rating (0-5)
 * @property {string} [initials] - Display initials
 * @property {string} [color] - UI color identifier
 */

export const VolunteerSchema = {
  required: ['id', 'name', 'skill', 'location', 'available'],
  
  types: {
    id: 'string',
    name: 'string',
    email: 'string',
    phone: 'string',
    skill: 'string',
    skills: 'array',
    location: 'object',
    'location.lat': 'number',
    'location.lng': 'number',
    'location.label': 'string',
    region: 'string',
    available: 'boolean',
    status: 'string',
    tasks: 'number',
    rating: 'number',
    initials: 'string',
    color: 'string',
  },

  defaults: {
    skills: [],
    tasks: 0,
    rating: 3,
    available: true,
    status: 'available',
    region: 'Unknown',
  },

  validation: {
    rating: (v) => v >= 0 && v <= 5,
    'location.lat': (v) => v >= -90 && v <= 90,
    'location.lng': (v) => v >= -180 && v <= 180,
  },
};

/**
 * Validate volunteer object against schema
 * @param {Object} data - Volunteer data to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateVolunteer(data) {
  const errors = [];
  
  // Check required fields
  VolunteerSchema.required.forEach((field) => {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Check types
  Object.entries(VolunteerSchema.types).forEach(([path, expectedType]) => {
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

  // Run custom validations
  Object.entries(VolunteerSchema.validation).forEach(([path, validator]) => {
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
 * Apply defaults to volunteer data
 * @param {Object} data - Raw volunteer data
 * @returns {Object} Volunteer with defaults applied
 */
export function applyVolunteerDefaults(data) {
  return {
    ...VolunteerSchema.defaults,
    ...data,
    skills: data.skills || VolunteerSchema.defaults.skills,
  };
}
