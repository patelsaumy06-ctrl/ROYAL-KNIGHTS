/**
 * Volunteer Model - Data access and transformation layer
 * 
 * Provides methods for working with volunteer data, including
 * filtering, sorting, and enrichment operations.
 */

import { applyVolunteerDefaults, validateVolunteer } from '../schemas/volunteer.schema';

/**
 * Volunteer Model class for data operations
 */
export class VolunteerModel {
  constructor(data) {
    this.data = applyVolunteerDefaults(data);
    this.validation = validateVolunteer(this.data);
  }

  /**
   * Check if volunteer is valid
   * @returns {boolean}
   */
  isValid() {
    return this.validation.valid;
  }

  /**
   * Get validation errors
   * @returns {string[]}
   */
  getErrors() {
    return this.validation.errors;
  }

  /**
   * Get volunteer data
   * @returns {Object}
   */
  toJSON() {
    return { ...this.data };
  }

  /**
   * Check if volunteer has specific skill
   * @param {string} skill - Skill to check
   * @returns {boolean}
   */
  hasSkill(skill) {
    const normalizedSkill = String(skill).toLowerCase();
    const allSkills = [
      this.data.skill,
      ...(this.data.skills || []),
    ].filter(Boolean).map((s) => String(s).toLowerCase());
    
    return allSkills.some((s) => s === normalizedSkill || s.includes(normalizedSkill));
  }

  /**
   * Check if volunteer is available for assignment
   * @returns {boolean}
   */
  isAvailable() {
    return this.data.available !== false && 
           String(this.data.status).toLowerCase() !== 'busy';
  }

  /**
   * Get experience level
   * @returns {string} 'novice' | 'intermediate' | 'experienced' | 'expert'
   */
  getExperienceLevel() {
    const tasks = this.data.tasks || 0;
    if (tasks >= 50) return 'expert';
    if (tasks >= 20) return 'experienced';
    if (tasks >= 5) return 'intermediate';
    return 'novice';
  }

  /**
   * Get performance tier
   * @returns {string} 'excellent' | 'good' | 'average' | 'below_average'
   */
  getPerformanceTier() {
    const rating = this.data.rating || 0;
    if (rating >= 4.5) return 'excellent';
    if (rating >= 3.5) return 'good';
    if (rating >= 2.5) return 'average';
    return 'below_average';
  }
}

/**
 * Create volunteer model from raw data
 * @param {Object} data - Raw volunteer data
 * @returns {VolunteerModel}
 */
export function createVolunteer(data) {
  return new VolunteerModel(data);
}

/**
 * Filter volunteers by availability
 * @param {Array} volunteers - Array of volunteer data
 * @returns {Array} Available volunteers
 */
export function filterAvailable(volunteers) {
  return volunteers.filter((v) => {
    const model = v instanceof VolunteerModel ? v : new VolunteerModel(v);
    return model.isAvailable();
  });
}

/**
 * Filter volunteers by skill
 * @param {Array} volunteers - Array of volunteer data
 * @param {string} skill - Required skill
 * @returns {Array} Volunteers with matching skill
 */
export function filterBySkill(volunteers, skill) {
  return volunteers.filter((v) => {
    const model = v instanceof VolunteerModel ? v : new VolunteerModel(v);
    return model.hasSkill(skill);
  });
}

/**
 * Sort volunteers by experience
 * @param {Array} volunteers - Array of volunteer data
 * @param {string} order - 'desc' | 'asc'
 * @returns {Array} Sorted volunteers
 */
export function sortByExperience(volunteers, order = 'desc') {
  return [...volunteers].sort((a, b) => {
    const tasksA = (a.tasks || 0);
    const tasksB = (b.tasks || 0);
    return order === 'desc' ? tasksB - tasksA : tasksA - tasksB;
  });
}

/**
 * Sort volunteers by rating
 * @param {Array} volunteers - Array of volunteer data
 * @param {string} order - 'desc' | 'asc'
 * @returns {Array} Sorted volunteers
 */
export function sortByRating(volunteers, order = 'desc') {
  return [...volunteers].sort((a, b) => {
    const ratingA = (a.rating || 0);
    const ratingB = (b.rating || 0);
    return order === 'desc' ? ratingB - ratingA : ratingA - ratingB;
  });
}

/**
 * Enrich volunteer data with computed fields
 * @param {Object} volunteer - Raw volunteer data
 * @returns {Object} Enriched volunteer
 */
export function enrichVolunteer(volunteer) {
  const model = new VolunteerModel(volunteer);
  return {
    ...volunteer,
    _computed: {
      isAvailable: model.isAvailable(),
      experienceLevel: model.getExperienceLevel(),
      performanceTier: model.getPerformanceTier(),
      skillCount: 1 + (volunteer.skills?.length || 0),
    },
  };
}

/**
 * Batch enrich multiple volunteers
 * @param {Array} volunteers - Array of volunteer data
 * @returns {Array} Enriched volunteers
 */
export function enrichVolunteers(volunteers) {
  return volunteers.map(enrichVolunteer);
}
