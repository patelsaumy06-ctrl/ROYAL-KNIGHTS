/**
 * Task Model - Data access and transformation layer
 * 
 * Provides methods for working with task/need data, including
 * status tracking, priority management, and progress calculation.
 */

import { applyTaskDefaults, validateTask, getTaskProgress } from '../schemas/task.schema';

/**
 * Task Model class for data operations
 */
export class TaskModel {
  constructor(data) {
    this.data = applyTaskDefaults(data);
    this.validation = validateTask(this.data);
  }

  /**
   * Check if task is valid
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
   * Get task data
   * @returns {Object}
   */
  toJSON() {
    return { ...this.data };
  }

  /**
   * Get task progress percentage
   * @returns {number} Progress 0-100
   */
  getProgress() {
    return getTaskProgress(this.data);
  }

  /**
   * Check if task is fully assigned
   * @returns {boolean}
   */
  isFullyAssigned() {
    return this.data.assigned >= this.data.volunteers;
  }

  /**
   * Check if task is complete
   * @returns {boolean}
   */
  isComplete() {
    return this.data.status === 'resolved' || this.data.status === 'closed';
  }

  /**
   * Check if task is urgent
   * @returns {boolean}
   */
  isUrgent() {
    return this.data.priority === 'urgent' || this.data.priority === 'high';
  }

  /**
   * Get remaining volunteer slots
   * @returns {number}
   */
  getRemainingSlots() {
    return Math.max(0, this.data.volunteers - this.data.assigned);
  }

  /**
   * Get task age in hours
   * @returns {number|null}
   */
  getAgeHours() {
    if (!this.data.createdAt) return null;
    const created = new Date(this.data.createdAt).getTime();
    return (Date.now() - created) / (1000 * 60 * 60);
  }

  /**
   * Check if task requires specific skill
   * @param {string} skill - Skill to check
   * @returns {boolean}
   */
  requiresSkill(skill) {
    if (!this.data.requiredSkills?.length) return false;
    const normalized = String(skill).toLowerCase();
    return this.data.requiredSkills.some(
      (s) => String(s).toLowerCase() === normalized || 
             String(s).toLowerCase().includes(normalized)
    );
  }

  /**
   * Can volunteer be assigned to this task
   * @returns {boolean}
   */
  canAcceptVolunteers() {
    return !this.isComplete() && !this.isFullyAssigned();
  }
}

/**
 * Create task model from raw data
 * @param {Object} data - Raw task data
 * @returns {TaskModel}
 */
export function createTask(data) {
  return new TaskModel(data);
}

/**
 * Filter tasks by status
 * @param {Array} tasks - Array of task data
 * @param {string} status - Status to filter by
 * @returns {Array} Filtered tasks
 */
export function filterByStatus(tasks, status) {
  return tasks.filter((t) => t.status === status);
}

/**
 * Filter tasks by priority
 * @param {Array} tasks - Array of task data
 * @param {string} priority - Priority to filter by
 * @returns {Array} Filtered tasks
 */
export function filterByPriority(tasks, priority) {
  return tasks.filter((t) => t.priority === priority);
}

/**
 * Get active (non-completed) tasks
 * @param {Array} tasks - Array of task data
 * @returns {Array} Active tasks
 */
export function getActiveTasks(tasks) {
  return tasks.filter((t) => {
    const model = t instanceof TaskModel ? t : new TaskModel(t);
    return !model.isComplete();
  });
}

/**
 * Get tasks needing volunteers
 * @param {Array} tasks - Array of task data
 * @returns {Array} Tasks with open slots
 */
export function getTasksNeedingVolunteers(tasks) {
  return tasks.filter((t) => {
    const model = t instanceof TaskModel ? t : new TaskModel(t);
    return model.canAcceptVolunteers();
  });
}

/**
 * Sort tasks by creation time
 * @param {Array} tasks - Array of task data
 * @param {string} order - 'desc' | 'asc'
 * @returns {Array} Sorted tasks
 */
export function sortByCreated(tasks, order = 'desc') {
  return [...tasks].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });
}

/**
 * Sort tasks by urgency (priority + age)
 * @param {Array} tasks - Array of task data
 * @returns {Array} Sorted tasks
 */
export function sortByUrgency(tasks) {
  const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
  
  return [...tasks].sort((a, b) => {
    const modelA = a instanceof TaskModel ? a : new TaskModel(a);
    const modelB = b instanceof TaskModel ? b : new TaskModel(b);
    
    const priorityA = priorityWeight[a.priority] || 0;
    const priorityB = priorityWeight[b.priority] || 0;
    
    if (priorityA !== priorityB) return priorityB - priorityA;
    
    const ageA = modelA.getAgeHours() || 0;
    const ageB = modelB.getAgeHours() || 0;
    return ageB - ageA;
  });
}

/**
 * Group tasks by region
 * @param {Array} tasks - Array of task data
 * @returns {Object} Tasks grouped by region
 */
export function groupByRegion(tasks) {
  return tasks.reduce((acc, task) => {
    const region = task.region || 'Unknown';
    if (!acc[region]) acc[region] = [];
    acc[region].push(task);
    return acc;
  }, {});
}

/**
 * Group tasks by category
 * @param {Array} tasks - Array of task data
 * @returns {Object} Tasks grouped by category
 */
export function groupByCategory(tasks) {
  return tasks.reduce((acc, task) => {
    const category = task.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {});
}

/**
 * Enrich task with computed fields
 * @param {Object} task - Raw task data
 * @returns {Object} Enriched task
 */
export function enrichTask(task) {
  const model = new TaskModel(task);
  return {
    ...task,
    _computed: {
      progress: model.getProgress(),
      isFullyAssigned: model.isFullyAssigned(),
      isComplete: model.isComplete(),
      isUrgent: model.isUrgent(),
      remainingSlots: model.getRemainingSlots(),
      ageHours: model.getAgeHours(),
      canAcceptVolunteers: model.canAcceptVolunteers(),
    },
  };
}

/**
 * Batch enrich multiple tasks
 * @param {Array} tasks - Array of task data
 * @returns {Array} Enriched tasks
 */
export function enrichTasks(tasks) {
  return tasks.map(enrichTask);
}
