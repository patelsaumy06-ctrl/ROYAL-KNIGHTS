import { db } from '../firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { validateNeed } from '../utils/validation';

const ngoIncidentsCollection = (email) => collection(db, 'ngos', email, 'incidents');
const ngoResourcesCollection = (email) => collection(db, 'ngos', email, 'resources');
const ngoNotificationsCollection = (email) => collection(db, 'ngos', email, 'notifications');

const mapDocs = (snapshot) =>
  snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));

const buildNeedsQuery = (email, options = {}) => {
  const { pageSize = 200, statuses = [] } = options;
  const clauses = [];
  if (Array.isArray(statuses) && statuses.length > 0) {
    clauses.push(where('status', 'in', statuses));
  }
  clauses.push(orderBy('timestamp', 'desc'));
  clauses.push(limit(pageSize));
  return query(ngoIncidentsCollection(email), ...clauses);
};

const buildResourcesQuery = (email, options = {}) => {
  const { pageSize = 200, availability = null } = options;
  const clauses = [];
  if (typeof availability === 'boolean') {
    clauses.push(where('availability', '==', availability));
  }
  clauses.push(orderBy('updatedAt', 'desc'));
  clauses.push(limit(pageSize));
  return query(ngoResourcesCollection(email), ...clauses);
};

const buildNotificationsQuery = (email, options = {}) => {
  const { pageSize = 100, unreadOnly = false, cursor = null } = options;
  const clauses = [];
  if (unreadOnly) clauses.push(where('read', '==', false));
  clauses.push(orderBy('createdAt', 'desc'));
  if (cursor) clauses.push(startAfter(cursor));
  clauses.push(limit(pageSize));
  return query(ngoNotificationsCollection(email), ...clauses);
};

export const subscribeToNeeds = (email, onData, onError, options = {}) => {
  if (!email) return () => {};
  return onSnapshot(
    buildNeedsQuery(email, options),
    (snapshot) => {
      onData(mapDocs(snapshot));
    },
    (error) => {
      console.error('Needs realtime listener failed', error);
      onError?.(error);
    }
  );
};

export const subscribeToIncidents = subscribeToNeeds;

export const subscribeToResources = (email, onData, onError, options = {}) => {
  if (!email) return () => {};
  return onSnapshot(
    buildResourcesQuery(email, options),
    (snapshot) => {
      onData(mapDocs(snapshot));
    },
    (error) => {
      console.error('Resources realtime listener failed', error);
      onError?.(error);
    }
  );
};

export const subscribeToNotifications = (email, onData, onError, options = {}) => {
  if (!email) return () => {};
  return onSnapshot(
    buildNotificationsQuery(email, options),
    (snapshot) => {
      onData(mapDocs(snapshot));
    },
    (error) => {
      console.error('Notifications realtime listener failed', error);
      onError?.(error);
    }
  );
};

export const subscribeToUnreadNotificationCount = (email, onCount, onError) => {
  if (!email) return () => {};
  const unreadQuery = query(ngoNotificationsCollection(email), where('read', '==', false));
  return onSnapshot(
    unreadQuery,
    (snapshot) => onCount(snapshot.size),
    (error) => {
      console.error('Unread count listener failed', error);
      onError?.(error);
    }
  );
};

export const getNotificationsPage = async (email, options = {}) => {
  if (!email) throw new Error('Cannot fetch notifications without NGO email.');
  const q = buildNotificationsQuery(email, options);
  const snapshot = await getDocs(q);
  const items = mapDocs(snapshot);
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
  const pageSize = options.pageSize ?? 100;
  return {
    items,
    lastVisible,
    hasMore: snapshot.docs.length === pageSize,
  };
};

export const addNeed = async (email, needData) => {
  if (!email) throw new Error('Cannot add need without NGO email.');
  try {
    // Validate/sanitize before write to block malformed payloads and stored XSS strings.
    const validation = validateNeed(needData, { ngoEmail: email });
    if (!validation.isValid) {
      throw new Error(Object.values(validation.errors)[0] || 'Invalid need data.');
    }
    const payload = {
      title: validation.sanitizedData.category,
      description: validation.sanitizedData.reportText || validation.sanitizedData.category,
      location: validation.sanitizedData.location,
      severity: validation.sanitizedData.priority,
      timestamp: serverTimestamp(),
      status: validation.sanitizedData?.status ?? 'open',
      // Keep app compatibility fields while moving to incident schema.
      ...validation.sanitizedData,
    };
    const ref = await addDoc(ngoIncidentsCollection(email), payload);
    return ref.id;
  } catch (error) {
    console.error('Failed to add need', error);
    throw error;
  }
};

export const updateNeedStatus = async (email, needId, status) => {
  if (!email) throw new Error('Cannot update need without NGO email.');
  if (!needId) throw new Error('Need id is required to update status.');
  try {
    const ref = doc(db, 'ngos', email, 'incidents', needId);
    await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Failed to update need status', error);
    throw error;
  }
};

export const deleteNeed = async (email, needId) => {
  if (!email) throw new Error('Cannot delete incident without NGO email.');
  if (!needId) throw new Error('Incident id is required for delete.');
  try {
    const ref = doc(db, 'ngos', email, 'incidents', needId);
    await deleteDoc(ref);
    return true;
  } catch (error) {
    console.error('Failed to delete incident', error);
    throw error;
  }
};

export const getAllIncidents = async (email, options = {}) => {
  if (!email) throw new Error('Cannot fetch incidents without NGO email.');
  const snapshot = await getDocs(buildNeedsQuery(email, options));
  return mapDocs(snapshot);
};

export const createIncident = addNeed;
export const updateIncidentStatus = updateNeedStatus;
export const deleteIncident = deleteNeed;

export const createResource = async (email, resourceData) => {
  if (!email) throw new Error('Cannot add resource without NGO email.');
  const payload = {
    type: String(resourceData?.type || '').trim(),
    availability: Boolean(resourceData?.availability),
    location: String(resourceData?.location || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(ngoResourcesCollection(email), payload);
  return ref.id;
};

export const getAllResources = async (email, options = {}) => {
  if (!email) throw new Error('Cannot fetch resources without NGO email.');
  const snapshot = await getDocs(buildResourcesQuery(email, options));
  return mapDocs(snapshot);
};
