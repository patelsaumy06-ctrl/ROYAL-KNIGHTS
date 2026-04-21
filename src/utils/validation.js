const MAX_NAME_LENGTH = 50;
const MAX_NEED_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9()\-\s]{7,20}$/;

function sanitizeText(value, maxLength) {
  const raw = String(value ?? "");
  const trimmed = raw.trim();
  // Strip common HTML/script delimiters to reduce stored XSS vectors in rendered text.
  const stripped = trimmed
    .replace(/[<>`]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "");
  return typeof maxLength === "number" ? stripped.slice(0, maxLength) : stripped;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeEmail(value) {
  return sanitizeText(value, 254).toLowerCase();
}

function addError(errors, field, message) {
  errors[field] = message;
}

export function validateNeed(data = {}, options = {}) {
  const errors = {};
  const ngoEmail = normalizeEmail(options.ngoEmail ?? data.email);
  const location = sanitizeText(data.location, MAX_NEED_TITLE_LENGTH);
  const category = sanitizeText(data.category, MAX_NEED_TITLE_LENGTH);
  const description = sanitizeText(data.reportText ?? data.description, MAX_DESCRIPTION_LENGTH);
  const priority = sanitizeText(data.priority, 20).toLowerCase();
  const region = sanitizeText(data.region, 60);
  const deadline = sanitizeText(data.deadline, 20);
  const volunteers = Number(data.volunteers);
  const assigned = Number(data.assigned ?? 0);
  const lat = data.lat == null ? null : Number(data.lat);
  const lng = data.lng == null ? null : Number(data.lng);

  if (!EMAIL_REGEX.test(ngoEmail)) addError(errors, "email", "A valid NGO email is required.");
  if (!category) addError(errors, "category", "Need title/category is required.");
  else if (category.length > MAX_NEED_TITLE_LENGTH) addError(errors, "category", `Need title must be <= ${MAX_NEED_TITLE_LENGTH} characters.`);
  if (!location) addError(errors, "location", "Location is required.");
  if (description.length > MAX_DESCRIPTION_LENGTH) addError(errors, "description", `Description must be <= ${MAX_DESCRIPTION_LENGTH} characters.`);
  if (!["urgent", "medium", "low", "open", "active", "resolved", "pending"].includes(priority) && !["urgent", "medium", "low"].includes(priority)) {
    addError(errors, "priority", "Priority must be urgent, medium, or low.");
  }
  if (!deadline) addError(errors, "deadline", "Deadline is required.");
  if (!Number.isInteger(volunteers) || volunteers < 1 || volunteers > 1000) {
    addError(errors, "volunteers", "Volunteers must be a number between 1 and 1000.");
  }
  if (!Number.isInteger(assigned) || assigned < 0 || assigned > volunteers) {
    addError(errors, "assigned", "Assigned count must be between 0 and volunteers needed.");
  }
  if (lat != null && (!isFiniteNumber(lat) || lat < -90 || lat > 90)) addError(errors, "lat", "Latitude must be between -90 and 90.");
  if (lng != null && (!isFiniteNumber(lng) || lng < -180 || lng > 180)) addError(errors, "lng", "Longitude must be between -180 and 180.");

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...data,
      email: ngoEmail,
      location,
      category,
      reportText: description,
      region,
      priority: ["urgent", "medium", "low"].includes(priority) ? priority : "medium",
      volunteers: Number.isInteger(volunteers) ? volunteers : 1,
      assigned: Number.isInteger(assigned) ? assigned : 0,
      deadline,
      lat,
      lng,
    },
  };
}

export function validateVolunteer(data = {}, options = {}) {
  const errors = {};
  const ngoEmail = normalizeEmail(options.ngoEmail ?? data.email);
  const name = sanitizeText(data.name, MAX_NAME_LENGTH);
  const skill = sanitizeText(data.skill, 80);
  const region = sanitizeText(data.region, 60);
  const phone = sanitizeText(data.phone, 20);
  const lat = Number(data.lat);
  const lng = Number(data.lng);

  if (!EMAIL_REGEX.test(ngoEmail)) addError(errors, "email", "A valid NGO email is required.");
  if (!name || name.length < 2) addError(errors, "name", "Name must be between 2 and 50 characters.");
  if (name.length > MAX_NAME_LENGTH) addError(errors, "name", "Name must be between 2 and 50 characters.");
  if (!skill) addError(errors, "skill", "Skill is required.");
  if (!region) addError(errors, "region", "Region is required.");
  if (phone && !PHONE_REGEX.test(phone)) addError(errors, "phone", "Phone number format is invalid.");
  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) addError(errors, "lat", "Latitude must be between -90 and 90.");
  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) addError(errors, "lng", "Longitude must be between -180 and 180.");

  const numericFields = ["rating", "tasks", "points", "match", "distance"];
  numericFields.forEach((field) => {
    if (data[field] == null) return;
    const num = Number(data[field]);
    if (!Number.isFinite(num)) addError(errors, field, `${field} must be a valid number.`);
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...data,
      email: ngoEmail,
      name,
      skill,
      region,
      phone,
      lat,
      lng,
    },
  };
}
