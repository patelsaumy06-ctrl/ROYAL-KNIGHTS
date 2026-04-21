/**
 * Models Index - Central export for all data models
 * 
 * Provides a unified interface for data models across the ReliefLink platform.
 */

export {
  VolunteerModel,
  createVolunteer,
  filterAvailable,
  filterBySkill,
  sortByExperience,
  sortByRating,
  enrichVolunteer,
  enrichVolunteers,
} from './volunteer.model';

export {
  TaskModel,
  createTask,
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
} from './task.model';

/**
 * Model factory for creating model instances
 */
export const ModelFactory = {
  volunteer: (data) => import('./volunteer.model').then((m) => m.createVolunteer(data)),
  task: (data) => import('./task.model').then((m) => m.createTask(data)),
};

/**
 * Enrich mixed data collection
 * @param {string} type - Entity type ('volunteer', 'task')
 * @param {Array} data - Array of entity data
 * @returns {Promise<Array>} Enriched data
 */
export async function enrichCollection(type, data) {
  if (type === 'volunteer') {
    const { enrichVolunteers } = await import('./volunteer.model');
    return enrichVolunteers(data);
  }
  if (type === 'task') {
    const { enrichTasks } = await import('./task.model');
    return enrichTasks(data);
  }
  return data;
}
