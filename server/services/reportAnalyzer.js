/**
 * Report Analyzer Service
 * Extracts structured community needs from unstructured NGO reports.
 * Uses Gemini LLM with keyword extraction fallback.
 */
import config from '../config.js';

// Keyword-based fallback extraction patterns
const NEEDS_PATTERNS = {
  food: /\b(food|hunger|starving|meal|ration|grocery|nutrition|hungry)\b/gi,
  medical: /\b(medical|medicine|health|hospital|doctor|clinic|injured|wound|sick|disease|ambulance|first.?aid)\b/gi,
  shelter: /\b(shelter|housing|home|tent|accommodation|roof|evacuation.?center|camp)\b/gi,
  water: /\b(water|drinking|thirsty|well|borewell|sanitation|hygiene)\b/gi,
  clothing: /\b(cloth|clothing|blanket|warmth|winter|coat|sweater)\b/gi,
  education: /\b(school|education|student|book|teacher|learning|study|child)\b/gi,
  transport: /\b(transport|vehicle|road|bridge|access|connectivity|bus|truck)\b/gi,
  communication: /\b(communication|phone|network|internet|connectivity|signal)\b/gi,
  electricity: /\b(electricity|power|light|generator|solar|grid)\b/gi,
  financial: /\b(money|cash|fund|financial|loan|compensation|relief.?fund)\b/gi,
  logistics: /\b(logistics|supply|delivery|distribution|storage|warehouse)\b/gi,
};

// Priority indicators for each need type
const NEED_PRIORITY_INDICATORS = {
  medical: {
    high: /\b(emergency|critical|severe|dying|death|casualt|urgent|life.?threatening|serious injury|burn|bleeding|unconscious)\b/gi,
    medium: /\b(sick|ill|fever|infection|disease|injured|wound|pain)\b/gi,
  },
  food: {
    high: /\b(starving|no food|hunger|malnutrition|severe shortage)\b/gi,
    medium: /\b(food|ration|meal|hungry|shortage|low supply)\b/gi,
  },
  shelter: {
    high: /\b(homeless|destroyed|displaced|evacuated|no shelter|burned down|collapsed)\b/gi,
    medium: /\b(shelter|tent|housing|damage|roof|accommodation)\b/gi,
  },
  water: {
    high: /\b(no water|contaminated|drought|severe shortage)\b/gi,
    medium: /\b(water|drinking|well|sanitation|hygiene)\b/gi,
  },
  logistics: {
    high: /\b(blocked|cut off|impossible|no access)\b/gi,
    medium: /\b(transport|road|delivery|supply|access)\b/gi,
  },
};

const URGENCY_PATTERNS = {
  high: /\b(critical|emergency|urgent|immediate|severe|life.?threatening|dying|death|casualt|disaster|catastrophe)\b/gi,
  medium: /\b(serious|concerning|needed|required|shortage|lack|problem|issue)\b/gi,
  low: /\b(improve|enhance|better|would like|optional|future|plan)\b/gi,
};

const LOCATION_PATTERNS = [
  // Village/Town/City followed by name
  /(?:village|town|city|district|taluka|tehsil|mandal)\s+(?:of\s+)?([A-Za-z\s]+?)(?:\s|,|\.|;|$)/gi,
  // In/at [Location]
  /\b(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
  // Gujarat districts
  /\b(Ahmedabad|Amreli|Anand|Aravalli|Banaskantha|Bharuch|Bhavnagar|Botad|Chhota Udaipur|Dahod|Dang|Devbhoomi Dwarka|Gandhinagar|Gir Somnath|Jamnagar|Junagadh|Kheda|Kutch|Mahisagar|Mehsana|Morbi|Narmada|Navsari|Panchmahal|Patan|Porbandar|Rajkot|Sabarkantha|Surat|Surendranagar|Tapi|Vadodara|Valsad)\b/gi,
];

const NUMBER_PATTERNS = [
  /(\d+(?:,\d+)*)\s*(?:people|persons|individuals|affected|victims|families|households)/i,
  /affected\s+(?:population|people)?\s*:?\s*(\d+(?:,\d+)*)/i,
  /(\d+(?:,\d+)*)\s*(?:dead|death|deceased|killed)/i,
  /(\d+(?:,\d+)*)\s*(?:injured|wounded|hurt)/i,
  /(\d+(?:,\d+)*)\s*(?:missing)/i,
  /population\s+(?:of\s+)?(\d+(?:,\d+)*)/i,
];

/**
 * Clean and normalize text for processing
 */
function normalizeText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,;:!?()-]/g, '')
    .trim();
}

/**
 * Extract needs using keyword patterns (fallback method)
 */
function extractNeedsWithKeywords(text) {
  const needs = [];
  const textLower = text.toLowerCase();

  for (const [category, pattern] of Object.entries(NEEDS_PATTERNS)) {
    // FIX: Global regexes (/gi) maintain lastIndex across calls. Calling .test()
    // without resetting lastIndex causes intermittent false negatives on repeated
    // invocations (the regex starts searching from where it last left off).
    pattern.lastIndex = 0;
    if (pattern.test(textLower)) {
      needs.push(category);
    }
  }

  return needs;
}

/**
 * Classify needs with individual priorities
 * Returns top 3-5 most important needs with type and priority
 */
function classifyNeedsWithPriority(text, detectedNeeds) {
  const classified = [];
  const textLower = text.toLowerCase();

  for (const need of detectedNeeds) {
    let priority = 'medium'; // default

    // Check for high priority indicators
    // FIX: Reset lastIndex on global regexes before each test() call.
    if (NEED_PRIORITY_INDICATORS[need]?.high) NEED_PRIORITY_INDICATORS[need].high.lastIndex = 0;
    if (NEED_PRIORITY_INDICATORS[need]?.medium) NEED_PRIORITY_INDICATORS[need].medium.lastIndex = 0;
    if (NEED_PRIORITY_INDICATORS[need]?.high?.test(textLower)) {
      priority = 'high';
    } else if (NEED_PRIORITY_INDICATORS[need]?.medium?.test(textLower)) {
      priority = 'medium';
    } else if (/\b(urgent|emergency|critical|severe|immediate)\b/gi.test(textLower)) {
      // Boost priority if general urgency keywords present
      priority = 'high';
    }

    // Medical emergencies and shelter loss are always high priority
    if ((need === 'medical' || need === 'shelter') && 
        /\b(emergency|destroyed|displaced|injured|burn|critical)\b/gi.test(textLower)) {
      priority = 'high';
    }

    classified.push({ type: need, priority });
  }

  // Sort by priority (high > medium > low)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  classified.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Limit to top 5 needs
  return classified.slice(0, 5);
}

/**
 * Extract urgency level using keyword patterns
 */
function extractUrgencyWithKeywords(text) {
  const textLower = text.toLowerCase();
  
  for (const [level, pattern] of Object.entries(URGENCY_PATTERNS)) {
    pattern.lastIndex = 0; // FIX: reset global regex state before each test()
    if (pattern.test(textLower)) {
      return level;
    }
  }
  
  return 'medium';
}

/**
 * Extract location using pattern matching
 */
function extractLocationWithKeywords(text) {
  for (const pattern of LOCATION_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const location = match[1] || match[0];
      if (location && location.length > 2) {
        return location.trim();
      }
    }
  }
  return '';
}

/**
 * Extract affected people estimate using pattern matching
 */
function extractAffectedPeopleWithKeywords(text) {
  for (const pattern of NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const number = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(number) && number > 0) {
        return number;
      }
    }
  }
  return 0;
}

/**
 * Generate a professional crisis summary (emergency response brief style)
 * Max 2 sentences, formal tone, includes what/where/impact/needs
 */
function generateSummary(text, location, urgency, needs, affectedCount) {
  // Extract event type from text
  const eventPatterns = [
    { pattern: /\b(flood|flooding|heavy rain|overflow)\b/gi, event: 'flood' },
    { pattern: /\b(fire|burning|blaze|burned)\b/gi, event: 'fire' },
    { pattern: /\b(earthquake|quake|tremor)\b/gi, event: 'earthquake' },
    { pattern: /\b(cyclone|storm|hurricane|typhoon)\b/gi, event: 'cyclone' },
    { pattern: /\b(drought|water shortage)\b/gi, event: 'drought' },
    { pattern: /\b(landslide|mudslide)\b/gi, event: 'landslide' },
    { pattern: /\b(collapse|collapsed|structural failure)\b/gi, event: 'structural collapse' },
    { pattern: /\b(outbreak|epidemic|disease spread)\b/gi, event: 'disease outbreak' },
    { pattern: /\b(accident|crash|collision)\b/gi, event: 'accident' },
    { pattern: /\b(violence|attack|conflict|riot)\b/gi, event: 'security incident' },
  ];

  let eventType = 'incident';
  for (const { pattern, event } of eventPatterns) {
    if (pattern.test(text)) {
      eventType = event;
      break;
    }
  }

  // Determine severity descriptor
  const severity = urgency === 'high' ? 'high-severity' : 
                   urgency === 'medium' ? 'moderate' : 'low-severity';

  // Format location
  const locationStr = location || 'the affected area';

  // Format impact
  let impactStr = '';
  if (affectedCount > 0) {
    impactStr = `affected over ${affectedCount.toLocaleString()} residents`;
  } else {
    impactStr = 'affected an unknown number of residents';
  }

  // Format needs
  let needsStr = '';
  if (needs.length > 0) {
    const needLabels = {
      food: 'food supplies',
      medical: 'medical aid',
      shelter: 'emergency shelter',
      water: 'clean water',
      clothing: 'clothing and blankets',
      education: 'educational support',
      transport: 'transportation assistance',
      communication: 'communication support',
      electricity: 'power restoration',
      financial: 'financial assistance',
      logistics: 'logistics support',
    };
    const needList = needs.slice(0, 4).map(n => needLabels[n] || n);
    if (needList.length === 1) {
      needsStr = `creating urgent need for ${needList[0]}`;
    } else if (needList.length === 2) {
      needsStr = `creating urgent need for ${needList.join(' and ')}`;
    } else {
      const last = needList.pop();
      needsStr = `creating urgent need for ${needList.join(', ')}, and ${last}`;
    }
  } else {
    needsStr = 'requiring immediate assessment of needs';
  }

  // Build the summary (max 2 sentences)
  const sentence1 = `A ${severity} ${eventType} in ${locationStr} has ${impactStr}.`;
  const sentence2 = needsStr.charAt(0).toUpperCase() + needsStr.slice(1) + '.';

  return `${sentence1} ${sentence2}`;
}

/**
 * Calculate confidence score for keyword-based extraction
 * 
 * Guidelines:
 * - 0.9+ → clear, explicit info in text
 * - 0.7–0.9 → mostly clear, minor assumptions
 * - 0.5–0.7 → inferred or partial data
 * - <0.5 → unclear or weak signals
 */
function calculateConfidence(text, location, urgency, needs, affectedCount) {
  let score = 0.5; // Base for fallback method (inferred/partial data)
  
  // Location clarity (max +0.25)
  // Explicit location mentions (village of X, district Y) = higher confidence
  const explicitLocationPattern = /(?:village|town|city|district|taluka)\s+(?:of\s+)?([A-Z][a-z]+)/i;
  if (explicitLocationPattern.test(text)) {
    score += 0.25; // Clear, explicit location
  } else if (location) {
    score += 0.15; // Location found but less explicit
  } else {
    score -= 0.15; // No location found
  }
  
  // Urgency clarity (max +0.15)
  // Explicit urgency words = higher confidence
  const explicitUrgencyPattern = /\b(urgent|emergency|critical|immediate|severe|life.?threatening)\b/gi;
  const urgencyMatches = text.match(explicitUrgencyPattern);
  if (urgencyMatches && urgencyMatches.length >= 2) {
    score += 0.15; // Multiple explicit urgency indicators
  } else if (urgencyMatches) {
    score += 0.1; // Single urgency indicator
  } else if (urgency === 'high') {
    score += 0.05; // High urgency inferred but not explicit
  }
  
  // Needs reliability (max +0.15)
  if (needs.length >= 3) {
    score += 0.15; // Multiple explicit needs
  } else if (needs.length > 0) {
    score += 0.1; // Some needs identified
  }
  
  // Number reliability (max +0.1)
  // Explicit numbers (e.g., "300 people", "50 families") = higher confidence
  const explicitNumberPattern = /\b\d{2,4}\s+(?:people|persons|families|households|affected)\b/i;
  if (explicitNumberPattern.test(text) && affectedCount > 0) {
    score += 0.1; // Clear, explicit number
  } else if (affectedCount > 0) {
    score += 0.05; // Number found but less explicit
  }
  
  // Text quality penalties
  if (text.length < 50) {
    score -= 0.15; // Very short text - unclear signals
  } else if (text.length < 100) {
    score -= 0.05; // Short text - partial data
  }
  
  // Messy/unclear text penalty
  const typoIndicators = (text.match(/\b(ppl|r|u|ur|dis|da)\b/gi) || []).length;
  if (typoIndicators > 3) {
    score -= 0.1; // Heavy slang/typos reduce confidence
  }
  
  // Ensure score is within bounds and round to 2 decimal places
  score = Math.max(0.1, Math.min(0.95, score));
  return Math.round(score * 100) / 100;
}

/**
 * Generate reasoning for keyword-based extraction
 */
function generateReasoning(text, location, urgency, needs, affectedCount) {
  const locationReason = location 
    ? `Extracted "${location}" using pattern matching for location keywords (village, town, district, etc.)`
    : 'No location pattern matched in the text. Looked for village/town/district names and Gujarat district names.';
  
  const urgencyReason = urgency === 'high'
    ? 'Assigned "high" urgency due to presence of critical keywords: emergency, urgent, severe, death, disaster, etc.'
    : urgency === 'medium'
    ? 'Assigned "medium" urgency due to presence of keywords: shortage, needed, problem, issue, etc.'
    : urgency === 'low'
    ? 'Assigned "low" urgency due to presence of keywords: improve, would like, optional, future, etc.'
    : 'Defaulted to "medium" urgency - no clear urgency indicators found.';
  
  const needsReason = needs.length > 0
    ? `Identified needs [${needs.join(', ')}] by matching keywords: ${needs.map(n => {
        const patterns = {
          food: 'food, hunger, starving',
          medical: 'medical, doctor, hospital, sick',
          shelter: 'shelter, tent, housing',
          water: 'water, drinking, sanitation',
          clothing: 'clothing, blanket, warm',
          education: 'school, education, student',
          transport: 'transport, road, vehicle',
          communication: 'communication, phone, network',
          electricity: 'electricity, power, light',
          financial: 'money, fund, financial',
          logistics: 'logistics, supply, delivery',
        };
        return `${n} (${patterns[n]})`;
      }).join('; ')}`
    : 'No specific need categories identified through keyword matching.';
  
  const affectedReason = affectedCount > 0
    ? `Extracted number ${affectedCount} using pattern matching for: people, families, households, affected population, etc.`
    : 'No specific number for affected people found in text. Patterns searched: X people/families/households, population of X, etc.';
  
  return {
    location: locationReason,
    urgency_level: urgencyReason,
    needs: needsReason,
    affected_people_estimate: affectedReason,
  };
}

/**
 * Fallback extraction when LLM is unavailable
 */
function fallbackExtraction(text) {
  const normalized = normalizeText(text);
  
  const location = extractLocationWithKeywords(normalized);
  const urgency = extractUrgencyWithKeywords(normalized);
  const needsList = extractNeedsWithKeywords(normalized);
  const affectedCount = extractAffectedPeopleWithKeywords(normalized);
  const classifiedNeeds = classifyNeedsWithPriority(text, needsList);
  
  return {
    location,
    urgency_level: urgency,
    needs: classifiedNeeds,
    affected_people_estimate: affectedCount,
    summary: generateSummary(text, location, urgency, needsList, affectedCount),
    confidence_score: calculateConfidence(text, location, urgency, needsList, affectedCount),
    _extraction_method: 'keyword_fallback',
    _reasoning: generateReasoning(text, location, urgency, needsList, affectedCount),
  };
}

/**
 * System prompt for Gemini LLM with reasoning and classified needs
 */
const SYSTEM_PROMPT = `You are an advanced AI system for analyzing NGO field reports and generating decision-ready insights.

Your task is to extract structured, high-quality information from unstructured crisis reports.

Return ONLY valid JSON in this exact format:

{
  "location": "",
  "urgency_level": "low | medium | high",
  "needs": [
    {
      "type": "medical | food | shelter | water | clothing | education | transport | communication | electricity | financial | logistics | other",
      "priority": "low | medium | high"
    }
  ],
  "affected_people_estimate": 0,
  "summary": "",
  "confidence_score": 0.0,
  "_extraction_method": "llm",
  "_reasoning": {
    "location": "",
    "urgency_level": "",
    "needs": "",
    "affected_people_estimate": ""
  }
}

INSTRUCTIONS:
1. LOCATION:
- Extract the most specific location (city/region)
- If unclear, infer cautiously

2. URGENCY LEVEL:
- HIGH: disasters, injuries, displacement, "urgent", "critical"
- MEDIUM: shortages, disruptions
- LOW: minor or stable situations

3. NEEDS (IMPORTANT):
- Identify top 3-5 most critical needs
- Assign priority:
  - HIGH → life-threatening (medical, shelter loss)
  - MEDIUM → essential (food, water)
  - LOW → support/logistics

4. AFFECTED PEOPLE:
- Extract number if mentioned
- If not exact, estimate conservatively
- Do NOT hallucinate unrealistic numbers

5. SUMMARY:
- Write 1-2 sentences
- Include:
  - what happened
  - where
  - scale of impact
  - key needs
- Use professional disaster-response tone
- Do NOT copy text directly

6. CONFIDENCE SCORE:
- 0.9+ → explicit clear data
- 0.7–0.9 → mostly clear
- 0.5–0.7 → partial inference
- <0.5 → unclear

7. REASONING:
- Briefly justify:
  - why location was chosen
  - why urgency level was assigned
  - why needs were selected
  - how affected_people was estimated

RULES:
- Return ONLY JSON (no explanation outside JSON)
- Do NOT hallucinate missing data
- If uncertain, lower confidence_score
- Keep output clean and structured`;

/**
 * Clean JSON response from LLM
 */
function cleanJson(text = '') {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();
}

/**
 * Validate and normalize the extracted data
 */
function validateAndNormalize(data) {
  const validUrgencyLevels = ['low', 'medium', 'high'];
  const validNeeds = ['food', 'medical', 'shelter', 'water', 'clothing', 'education', 'transport', 'communication', 'electricity', 'financial', 'logistics'];

  // Validate confidence score
  let confidenceScore = typeof data.confidence_score === 'number' 
    ? Math.max(0, Math.min(1, data.confidence_score))
    : 0.5;

  // Validate needs array (now contains objects with type and priority)
  let validatedNeeds = [];
  if (Array.isArray(data.needs)) {
    // Check if needs is already in new format (array of objects)
    if (data.needs.length > 0 && typeof data.needs[0] === 'object' && data.needs[0].type) {
      validatedNeeds = data.needs
        .filter(item => item && typeof item === 'object' && item.type)
        .map(item => ({
          type: validNeeds.includes(item.type.toLowerCase()) ? item.type.toLowerCase() : 'other',
          priority: validUrgencyLevels.includes(item.priority) ? item.priority : 'medium',
        }))
        .slice(0, 5); // Limit to top 5
    } else if (data.needs.length > 0 && typeof data.needs[0] === 'string') {
      // Old format: array of strings - convert to new format with default medium priority
      validatedNeeds = data.needs
        .filter(n => validNeeds.includes(n.toLowerCase()))
        .map(n => ({ type: n.toLowerCase(), priority: 'medium' }))
        .slice(0, 5);
    }
  }

  // Validate _reasoning object
  let validatedReasoning = {};
  if (data._reasoning && typeof data._reasoning === 'object') {
    validatedReasoning = {
      location: typeof data._reasoning.location === 'string' ? data._reasoning.location.trim() : '',
      urgency_level: typeof data._reasoning.urgency_level === 'string' ? data._reasoning.urgency_level.trim() : '',
      needs: typeof data._reasoning.needs === 'string' ? data._reasoning.needs.trim() : '',
      affected_people_estimate: typeof data._reasoning.affected_people_estimate === 'string' ? data._reasoning.affected_people_estimate.trim() : '',
    };
  }

  return {
    location: typeof data.location === 'string' ? data.location.trim() : '',
    urgency_level: validUrgencyLevels.includes(data.urgency_level) ? data.urgency_level : 'medium',
    needs: validatedNeeds,
    affected_people_estimate: typeof data.affected_people_estimate === 'number' 
      ? Math.max(0, Math.round(data.affected_people_estimate))
      : 0,
    summary: typeof data.summary === 'string' ? data.summary.trim() : '',
    confidence_score: confidenceScore,
    _extraction_method: typeof data._extraction_method === 'string' ? data._extraction_method : 'unknown',
    _reasoning: validatedReasoning,
  };
}

/**
 * Analyze report using Claude (primary provider)
 */
async function analyzeWithClaude(text) {
  if (!config.claudeApiKey) {
    throw new Error('CLAUDE_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Analyze this NGO report:\n\n${text}` },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';
  const cleaned = cleanJson(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    const result = validateAndNormalize(parsed);
    return { ...result, _extraction_method: 'llm_claude' };
  } catch (parseError) {
    throw new Error('Claude returned invalid JSON: ' + rawText.slice(0, 200));
  }
}

/**
 * Analyze report using Gemini LLM (fallback)
 */
async function analyzeWithGemini(text) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `\n\nAnalyze this NGO report:\n\n${text}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = cleanJson(rawText);

  try {
    const parsed = JSON.parse(cleaned);
    const result = validateAndNormalize(parsed);
    return { ...result, _extraction_method: 'llm_gemini' };
  } catch (parseError) {
    throw new Error('Gemini returned invalid JSON: ' + rawText.slice(0, 200));
  }
}

/**
 * Main function to analyze a report.
 * Provider chain: Claude → Gemini → keyword fallback
 *
 * @param {string} reportText - Raw unstructured report text
 * @param {Object} options - Analysis options
 * @param {boolean} options.useLLM - Whether to use LLM (default: true if any key configured)
 * @returns {Promise<Object>} - Structured community needs data
 */
export async function analyzeReport(reportText, options = {}) {
  if (!reportText || typeof reportText !== 'string') {
    throw new Error('Report text is required and must be a string');
  }

  const trimmedText = reportText.trim();
  if (trimmedText.length === 0) {
    throw new Error('Report text cannot be empty');
  }

  if (trimmedText.length > 50000) {
    throw new Error('Report text exceeds maximum length of 50000 characters');
  }

  const useLLM = options.useLLM !== false && (config.claudeApiKey || config.geminiApiKey);

  if (useLLM) {
    // Try Claude first
    if (config.claudeApiKey) {
      try {
        return await analyzeWithClaude(trimmedText);
      } catch (err) {
        console.warn('[ReportAnalyzer] Claude failed, trying Gemini:', err.message);
      }
    }
    // Fall back to Gemini
    if (config.geminiApiKey) {
      try {
        return await analyzeWithGemini(trimmedText);
      } catch (err) {
        console.warn('[ReportAnalyzer] Gemini failed, using keyword fallback:', err.message);
      }
    }
  }

  // Final fallback: keyword extraction
  return fallbackExtraction(trimmedText);
}

/**
 * Batch analyze multiple reports
 * 
 * @param {Array<{id: string, text: string}>} reports - Array of report objects
 * @returns {Promise<Array<{id: string, result: Object, error: string|null}>>}
 */
export async function analyzeReportsBatch(reports) {
  if (!Array.isArray(reports)) {
    throw new Error('Reports must be an array');
  }

  const results = await Promise.all(
    reports.map(async (report) => {
      try {
        const result = await analyzeReport(report.text);
        return {
          id: report.id,
          result,
          error: null,
        };
      } catch (error) {
        return {
          id: report.id,
          result: null,
          error: error.message,
        };
      }
    })
  );

  return results;
}

export default {
  analyzeReport,
  analyzeReportsBatch,
};
