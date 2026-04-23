/**
 * Report Analyzer Service
 * Extracts MULTIPLE structured community needs from unstructured NGO reports.
 *
 * Output contract (per need):
 *   { category, description, peopleAffected, priority, confidence,
 *     priorityScore, confidenceBreakdown, evidenceSignals }
 *
 * Confidence scoring model (0–1):
 *   - keywordDensity   : how many times category keywords appear (0–0.30)
 *   - numberEvidence   : explicit people count found in same sentence (0–0.25)
 *   - locationAnchor   : specific location name present (0–0.15)
 *   - urgencySignal    : urgency words detected near category (0–0.15)
 *   - textQuality      : report length + formality (0–0.15)
 *
 * Priority matrix (weights 1–10 → maps to critical/high/medium/low):
 *   severity (5) + populationImpact (3) + timeCriticality (2) = max 10
 *
 * Provider chain: Claude → Gemini → keyword fallback
 */
import config from '../config.js';

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['food', 'medical', 'shelter', 'water', 'clothing',
  'education', 'transport', 'communication', 'electricity', 'financial', 'logistics'];

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];

// ── Text pre-processing: handle messy NGO field reports ─────────────────

// Common NGO abbreviations → expanded form
const ABBREVIATION_MAP = [
  [/\bppl\b/gi,     'people'],
  [/\bw\/o\b/gi,    'without'],
  [/\bw\/\b/gi,     'with'],
  [/\bmed\b/gi,     'medical'],
  [/\bhsptl?\b/gi,  'hospital'],
  [/\bdist\.?\b/gi, 'district'],
  [/\bvil\.?\b/gi,  'village'],
  [/\bno\.\s*(\d)/gi, 'number $1'],
  [/\b(?:approx|appx|~)\s*(\d)/gi, 'approximately $1'],
  [/\bthousand\b/gi, '000'],
  [/\blakhs?\b/gi,   '00000'],
  [/\bcrores?\b/gi,  '0000000'],
  [/\bk\b(?=\s|$)/gi, '000'],           // "4.2k" style handled in parseNumber
  [/\bimmd?\b/gi,   'immediate'],
  [/\bv\.?\s*imp\b/gi, 'very important'],
  [/\burgnt\b/gi,   'urgent'],
];

// Hindi/transliterated terms common in Indian NGO reports → English equivalents
const TRANSLITERATION_MAP = [
  [/\bjal\b/gi,       'water'],
  [/\bpaani\b/gi,     'water'],
  [/\bpani\b/gi,      'water'],
  [/\bkhana\b/gi,     'food'],
  [/\bbhook\b/gi,     'hunger'],
  [/\bbhokh\b/gi,     'hunger'],
  [/\bilaaj\b/gi,     'medical treatment'],
  [/\bdawa(i)?\b/gi,  'medicine'],
  [/\bsaaf\b/gi,      'clean'],
  [/\bshiksha\b/gi,   'education'],
  [/\bvidyalay\b/gi,  'school'],
  [/\bpaathshala\b/gi,'school'],
  [/\bawas\b/gi,      'shelter'],
  [/\bagni\b/gi,      'fire'],
  [/\bbadh\b/gi,      'flood'],
  [/\bsukha\b/gi,     'drought'],
  [/\bbijli\b/gi,     'electricity'],
  [/\bsadak\b/gi,     'road'],
  [/\bprashan\b/gi,   'problem'],
];

// Written number words → digits (handles up to millions)
const WRITTEN_NUMBERS_MAP = [
  [/\bone\s+(?:hundred|100)\b/gi,   '100'],
  [/\btwo\s+hundred\b/gi,           '200'],
  [/\bfive\s+hundred\b/gi,          '500'],
  [/\bone\s+thousand\b/gi,          '1000'],
  [/\btwo\s+thousand\b/gi,          '2000'],
  [/\bfive\s+thousand\b/gi,         '5000'],
  [/\bten\s+thousand\b/gi,          '10000'],
  [/\bfifteen\s+hundred\b/gi,       '1500'],
  [/\beighteen\s+hundred\b/gi,      '1800'],
  [/\btwenty\s+(?:two|2)\s+hundred\b/gi, '2200'],
  [/\bfour\s+thousand\b/gi,         '4000'],
  [/\bfour\s+(?:thousand\s+)?(?:and\s+)?two\s+hundred\b/gi, '4200'],
];

// ── Detection patterns ────────────────────────────────────────────────────

// Keyword-based fallback extraction patterns (category → regex)
// Includes messy/abbreviated variants alongside clean forms
const NEEDS_PATTERNS = {
  food:          /\b(food|hunger|starving|starvation|meal|ration|grocery|nutrition|hungry|malnutrition|khana|bhook|bhojn|no food|food shortage|food supply|anna)\b/gi,
  medical:       /\b(medical|medicine|health|hospital|doctor|clinic|injured|wound|sick|disease|ambulance|first.?aid|fever|diarrhea|diarrhoea|casualt|treatment|ilaaj|dawa|nurse|medic|pharmacy|healthcare|illness|patient|casualty|vomiting|dehydrat)\b/gi,
  shelter:       /\b(shelter|housing|home|tent|tarpaulin|tarp|accommodation|roof|evacuation.?center|camp|displaced|homeless|collapsed|awas|ghar|relocation|temporary.?stay|night.?shelter|relief.?camp)\b/gi,
  water:         /\b(water|drinking|thirsty|well|borewell|bore.?well|handpump|pump|sanitation|hygiene|flood|contaminated|paani|pani|jal|waterlogged|inundated|clean.?water|potable|tap|pipeline|water.?supply|h2o)\b/gi,
  clothing:      /\b(cloth|clothing|blanket|warmth|winter|coat|sweater|garment|kit|uniform|bedsheet|bedding|woolen|rug)\b/gi,
  education:     /\b(school|education|student|book|teacher|learning|study|child|supplies|notebook|pencil|classroom|shiksha|vidyalay|paathshala|stationer|stationary|textbook|scholarship|midday.?meal|anganwadi)\b/gi,
  transport:     /\b(transport|vehicle|road|bridge|access|connectivity|bus|truck|blocked|cut.?off|sadak|pul|landslide|boat|evacuation.?route|passable|ambulance.?route|connectivity.?issue)\b/gi,
  communication: /\b(communication|phone|network|internet|connectivity|signal|mobile|tower|radio|broadcast|alert|siren)\b/gi,
  electricity:   /\b(electricity|power|light|generator|solar|grid|bijli|outage|blackout|transformer|line.?down|no.?power|supply.?cut)\b/gi,
  financial:     /\b(money|cash|fund|financial|loan|compensation|relief.?fund|aid|grant|stipend|allowance|subsidy|livelihood|income.?loss|crop.?damage)\b/gi,
  logistics:     /\b(logistics|supply|delivery|distribution|storage|warehouse|dispatch|inventory|stockpile|relief.?material|coordination)\b/gi,
};

// Evidence strength levels per category — more specific = higher confidence
const STRONG_EVIDENCE_PATTERNS = {
  water:     /\b(borewell|bore.?well|handpump|pump.{0,20}broken|water.{0,20}contaminated|water.{0,20}not.{0,10}available|no.{0,10}water|water.?supply.{0,20}fail)\b/gi,
  medical:   /\b(\d+.{0,20}need.{0,20}medical|doctor.{0,20}not.{0,20}available|no.{0,10}(?:doctor|hospital)|fever.{0,20}cases|diarrhea.{0,20}spread|casualt|injured)\b/gi,
  food:      /\b(no.{0,10}food|food.{0,20}shortage|starvation|ration.{0,20}not|malnutrition|hunger.{0,20}death)\b/gi,
  shelter:   /\b(house.{0,20}(?:collapsed|destroyed|damaged)|no.{0,10}shelter|homeless|displace[d]|living.{0,20}open)\b/gi,
  education: /\b(school.{0,20}(?:closed|damaged|missing|lack)|\d+.{0,20}students?.{0,20}(?:no|without|lack)|no.{0,10}supplies)\b/gi,
};

// Priority escalation indicators per category
const PRIORITY_CRITICAL_PATTERNS = {
  medical:  /\b(emergency|critical|severe|dying|death|casualt|life.?threatening|serious injury|burn|bleeding|unconscious|mass.?casualty|triage|icu|ventilator)\b/gi,
  shelter:  /\b(completely.{0,10}destroyed|no.{0,10}roof|living.{0,10}open|entire.{0,15}displace|collapse[d])\b/gi,
  water:    /\b(no.{0,10}water|water.{0,20}completely.{0,10}(?:cut|gone|unavailable)|zero.{0,10}water|days.{0,10}without.{0,10}water)\b/gi,
  food:     /\b(starvation|no.{0,10}food|days.{0,10}without.{0,10}(?:food|eating)|death.{0,10}(?:hunger|malnutrition))\b/gi,
};

const PRIORITY_HIGH_PATTERNS = {
  medical:  /\b(urgent|immediate|ambulance|wounded|injured|sick|fever|hospital|medicine.{0,20}need|treatment.{0,20}required)\b/gi,
  shelter:  /\b(homeless|displaced|evacuated|no shelter|damaged|temporary)\b/gi,
  water:    /\b(contaminated|borewell.{0,40}not working|non.?functional|pump.{0,20}broken|shortage)\b/gi,
  food:     /\b(shortage|running low|insufficient|lack|not enough|hungry)\b/gi,
  logistics:/\b(blocked|cut off|inaccessible|no access|road.{0,20}damage)\b/gi,
};

// Urgency patterns for overall report level
const URGENCY_PATTERNS = {
  critical: /\b(critical|catastrophe|mass.?casualty|life.?threatening|immediate.?evacuation|dying)\b/gi,
  high:     /\b(emergency|urgent|immediate|severe|disaster|serious|asap|sos)\b/gi,
  medium:   /\b(needed|required|shortage|lack|problem|issue|concern|affecting|disrupted)\b/gi,
  low:      /\b(improve|enhance|better|would like|optional|future|plan|gradual)\b/gi,
};

// Location patterns (generic + Gujarat + Maharashtra + Rajasthan districts)
const LOCATION_PATTERNS = [
  /(?:village|town|city|district|taluka|tehsil|mandal|gram panchayat|block)\s+(?:of\s+)?([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*,|\.|;|$)/gi,
  /\b(?:in|at|near|around|of)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)/g,
  /\b(Ahmedabad|Amreli|Anand|Aravalli|Banaskantha|Bharuch|Bhavnagar|Botad|Chhota Udaipur|Dahod|Dang|Devbhoomi Dwarka|Gandhinagar|Gir Somnath|Jamnagar|Junagadh|Kheda|Kutch|Mahisagar|Mehsana|Morbi|Narmada|Navsari|Panchmahal|Patan|Porbandar|Rajkot|Sabarkantha|Surat|Surendranagar|Tapi|Vadodara|Valsad|Pune|Nashik|Nagpur|Aurangabad|Solapur|Jaipur|Jodhpur|Udaipur|Kota|Ajmer|Bikaner|Patna|Gaya|Muzaffarpur|Bhagalpur|Bhopal|Indore|Gwalior|Jabalpur|Lucknow|Varanasi|Agra|Kanpur|Hyderabad|Chennai|Bengaluru|Kolkata|Mumbai|Delhi|Rajpur|Mehsana|Rajpura|Latur|Osmanabad|Bhuj|Morbi)\b/gi,
];

// Number extraction — global scope
const GLOBAL_NUMBER_PATTERNS = [
  /([\d][\d,]*)\s*k\s*(?:people|persons|affected|residents)/i,   // "4.2k people"
  /([\d][\d,\.]*)\s*(?:thousand|lakh|crore)\s*(?:people|persons|affected|residents)/i,
  /([\d][\d,]*)\s*(?:people|persons|individuals|affected|victims|families|households|residents)/i,
  /affected\s*(?:population|people)?\s*:?\s*([\d][\d,]*)/i,
  /(?:total|over|around|approximately|approx\.?)\s*([\d][\d,]*)\s*(?:people|persons|families|households|residents)/i,
  /population\s+(?:of\s+)?([\d][\d,]*)/i,
  /([\d][\d,]*)\s*(?:dead|death|deceased|killed)/i,
  /([\d][\d,]*)\s*(?:injured|wounded|hurt)/i,
  /([\d][\d,]*)\s*(?:missing|unaccounted)/i,
];

// Per-context number matchers (within ±2 sentences of category keyword)
const CONTEXT_NUMBER_PATTERNS = {
  medical:   [
    /([\d][\d,]*)\s*(?:people|persons|patients|individuals)?\s*need(?:s)?\s*(?:immediate\s+)?(?:medical|treatment|hospital|doctor)/i,
    /([\d][\d,]*)\s*(?:injured|sick|ill|wounded|patients?)/i,
    /(?:medical|treatment|hospital).{0,80}([\d][\d,]*)\s*(?:people|persons|patients)/i,
    /([\d][\d,]*)\s*(?:fever|diarrhea|diarrhoea|vomiting)\s*cases/i,
    /casualties?.{0,20}([\d][\d,]*)/i,
    /([\d][\d,]*).{0,20}casualties/i,
  ],
  water:     [
    /([\d][\d,]*)\s*(?:residents?|people|families|households).{0,80}(?:water|borewell|drinking|pump)/i,
    /(?:water|borewell|drinking|pump).{0,80}([\d][\d,]*)\s*(?:residents?|people|families)/i,
    /([\d][\d,]*)\s*(?:km|kilometers?)\s*(?:away|for water|to collect)/i,
    /([\d][\d,]*)\s*borewells?\s*(?:non.?functional|broken|not working|fail)/i,
  ],
  food:      [
    /([\d][\d,]*)\s*(?:people|families|households).{0,80}(?:food|ration|hungry|starving)/i,
    /(?:food|starvation|ration).{0,80}([\d][\d,]*)\s*(?:people|families)/i,
    /([\d][\d,]*)\s*(?:malnourished|starving|no food)/i,
  ],
  shelter:   [
    /([\d][\d,]*)\s*(?:people|families|households).{0,80}(?:shelter|displaced|homeless|evacuated)/i,
    /(?:displaced|homeless|shelter|evacuated).{0,80}([\d][\d,]*)\s*(?:people|families)/i,
    /([\d][\d,]*)\s*(?:houses?|homes?|huts?).{0,30}(?:collapsed|destroyed|damaged)/i,
  ],
  education: [
    /([\d][\d,]*)\s*(?:students?|children|kids|pupils|child)/i,
    /(?:school|students?|children).{0,60}([\d][\d,]*)/i,
    /([\d][\d,]*)\s*(?:class(?:rooms?)?|grade|standard)/i,
  ],
  clothing:  [
    /([\d][\d,]*)\s*(?:families?|people|individuals?).{0,60}(?:blanket|clothing|cloth|warmth)/i,
  ],
  transport: [
    /([\d][\d,]*)\s*(?:km|kilometers?|miles?).{0,30}(?:road|bridge|access)/i,
    /([\d][\d,]*)\s*(?:villages?|areas?|communities?).{0,30}(?:cut.?off|isolated|blocked)/i,
  ],
};

// Human-readable category labels used in descriptions
const CATEGORY_LABELS = {
  food:          'Food Supply',
  medical:       'Medical Aid',
  shelter:       'Shelter',
  water:         'Water & Sanitation',
  clothing:      'Clothing & Blankets',
  education:     'Education Supplies',
  transport:     'Transportation',
  communication: 'Communications',
  electricity:   'Power Restoration',
  financial:     'Financial Relief',
  logistics:     'Logistics & Supply',
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pre-process messy NGO field report text:
 * - Expand abbreviations (ppl → people, dist → district)
 * - Translate common Hindi/transliterated terms
 * - Normalise written numbers ("four thousand" → "4000")
 * - Standardise whitespace and punctuation
 */
function preprocessText(text) {
  let t = text;
  // 1. Written number words first (before other substitutions)
  for (const [pattern, replacement] of WRITTEN_NUMBERS_MAP) {
    t = t.replace(pattern, replacement);
  }
  // 2. Transliterate Hindi/regional terms
  for (const [pattern, replacement] of TRANSLITERATION_MAP) {
    t = t.replace(pattern, replacement);
  }
  // 3. Expand abbreviations
  for (const [pattern, replacement] of ABBREVIATION_MAP) {
    t = t.replace(pattern, replacement);
  }
  // 4. Normalise "4.2k" / "4,200k" style numbers → raw digits
  t = t.replace(/(\d+\.\d+)\s*k\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  t = t.replace(/(\d+)\s*k\b(?!\s*(?:m|g|b))/gi, (_, n) => String(parseInt(n, 10) * 1000));
  // 5. Expand lakh / crore
  t = t.replace(/(\d+\.?\d*)\s*lakhs?\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100000)));
  t = t.replace(/(\d+\.?\d*)\s*crores?\b/gi, (_, n) => String(Math.round(parseFloat(n) * 10000000)));
  // 6. Clean whitespace + basic punctuation normalisation
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function normalizeText(text) {
  return preprocessText(text)
    .replace(/[^\w\s.,;:!?()/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a number string — handles commas and simple floats.
 */
function parseNumber(str = '') {
  const cleaned = String(str).replace(/,/g, '').trim();
  const n = cleaned.includes('.') ? Math.round(parseFloat(cleaned)) : parseInt(cleaned, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/**
 * Split text into individual sentences for scoped extraction.
 */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?;])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Get a ±windowSize sentence window around sentences matching a keyword pattern.
 * Used to scope number extraction to the vicinity of a category mention.
 */
function getSentenceWindow(sentences, keywordRegex, windowSize = 2) {
  const result = [];
  for (let i = 0; i < sentences.length; i++) {
    keywordRegex.lastIndex = 0;
    if (keywordRegex.test(sentences[i])) {
      const start = Math.max(0, i - windowSize);
      const end   = Math.min(sentences.length - 1, i + windowSize);
      for (let j = start; j <= end; j++) {
        if (!result.includes(sentences[j])) result.push(sentences[j]);
      }
    }
  }
  return result.join(' ');
}

function cleanJson(text = '') {
  return text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
}

// ── Keyword-based extraction helpers ──────────────────────────────────────

function extractLocationWithKeywords(text) {
  for (const pattern of LOCATION_PATTERNS) {
    // Reset global regex before iterating
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const location = (match[1] || match[0] || '').trim();
      if (location && location.length > 2) return location;
    }
  }
  return '';
}

function extractGlobalAffectedCount(text) {
  for (const pattern of GLOBAL_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const n = parseNumber(match[1]);
      if (n > 0) return n;
    }
  }
  return 0;
}

/**
 * Extract people count scoped to a specific need category.
 * Falls back to the global affected count if no context-specific match.
 */
/**
 * Extract people count scoped to a specific need category.
 * Uses a ±2 sentence window around category keyword mentions for precision.
 * Falls back to global count if no context-specific number found.
 */
function extractPerNeedPeopleCount(text, category, globalCount) {
  // Build a keyword regex for the category to find relevant sentences
  const keyRegex = new RegExp(`\\b(${category}|${Object.keys(CONTEXT_NUMBER_PATTERNS).includes(category) ? category : ''})\\b`, 'gi');
  const sentences = splitSentences(text);
  const window = getSentenceWindow(sentences, keyRegex, 2);
  const searchText = window || text; // fall back to full text if no window found

  const patterns = CONTEXT_NUMBER_PATTERNS[category];
  if (patterns) {
    for (const p of patterns) {
      const match = searchText.match(p);
      if (match) {
        const n = parseNumber(match[1]);
        if (n > 0 && n <= 100_000_000) return n; // sanity cap: 100M
      }
    }
  }
  // For categories without specific patterns, try global patterns in the window
  if (window) {
    for (const p of GLOBAL_NUMBER_PATTERNS) {
      const match = window.match(p);
      if (match) {
        const n = parseNumber(match[1]);
        if (n > 0 && n <= 100_000_000) return n;
      }
    }
  }
  return globalCount || 0;
}

function extractUrgencyWithKeywords(text) {
  for (const [level, pattern] of Object.entries(URGENCY_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return level;
  }
  return 'medium';
}

/**
 * Multi-signal confidence scoring (0–1) with a detailed breakdown.
 *
 * Signals:
 *  keywordDensity   (0–0.30) — how many times category keywords appear
 *  strongEvidence   (0–0.25) — strong/specific patterns detected
 *  numberEvidence   (0–0.20) — explicit people count found in sentence window
 *  locationAnchor   (0–0.12) — specific location name present in text
 *  urgencySignal    (0–0.08) — urgency words found near category mention
 *  textQuality      (0–0.05) — report length & formality
 */
function computeNeedConfidence(category, text, hasPeopleCount, hasLocation) {
  const breakdown = {};

  // 1. Keyword density
  const pattern = NEEDS_PATTERNS[category];
  let kd = 0;
  if (pattern) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) || [];
    kd = matches.length >= 5 ? 0.30
       : matches.length >= 3 ? 0.22
       : matches.length >= 2 ? 0.15
       : matches.length >= 1 ? 0.08
       : 0;
  }
  breakdown.keywordDensity = kd;

  // 2. Strong/specific evidence
  let se = 0;
  const strongPattern = STRONG_EVIDENCE_PATTERNS[category];
  if (strongPattern) {
    strongPattern.lastIndex = 0;
    se = strongPattern.test(text) ? 0.25 : 0;
  }
  breakdown.strongEvidence = se;

  // 3. Number (people count) evidence
  const ne = hasPeopleCount ? 0.20 : 0;
  breakdown.numberEvidence = ne;

  // 4. Location anchor
  const la = hasLocation ? 0.12 : 0;
  breakdown.locationAnchor = la;

  // 5. Urgency signal near category
  let us = 0;
  const sentences = splitSentences(text);
  const window = getSentenceWindow(sentences, new RegExp(`\\b(${category}|${(NEEDS_PATTERNS[category]?.source || category).split('|')[0].replace(/\\b|\(|\)/g, '')})\\b`, 'gi'), 1);
  if (window) {
    URGENCY_PATTERNS.critical.lastIndex = 0; URGENCY_PATTERNS.high.lastIndex = 0;
    if (URGENCY_PATTERNS.critical.test(window)) us = 0.08;
    else if (URGENCY_PATTERNS.high.test(window)) us = 0.05;
  }
  breakdown.urgencySignal = us;

  // 6. Text quality
  const tq = text.length > 400 ? 0.05 : text.length > 150 ? 0.03 : 0.01;
  breakdown.textQuality = tq;

  const total = Math.round(Math.min(0.97, kd + se + ne + la + us + tq) * 100) / 100;
  return { score: total, breakdown };
}

/**
 * Priority matrix: score 0–10, then map to label.
 *
 * Dimensions:
 *  severity (0–5)         — life-threatening vs. supportive
 *  populationImpact (0–3) — number of people affected
 *  timeCriticality (0–2)  — how rapidly situation worsens without action
 *
 * Score bands: 8–10 = critical, 6–7.9 = high, 4–5.9 = medium, <4 = low
 */
function computePriorityMatrix(category, text, peopleAffected, urgencyLevel) {
  const breakdown = {};

  // Severity score
  let severity = 2; // default: moderate
  const critPattern = PRIORITY_CRITICAL_PATTERNS[category];
  const highPattern = PRIORITY_HIGH_PATTERNS[category];
  if (critPattern) { critPattern.lastIndex = 0; if (critPattern.test(text)) severity = 5; }
  if (severity < 5 && highPattern) { highPattern.lastIndex = 0; if (highPattern.test(text)) severity = 3.5; }
  // Intrinsic severity by category
  const CATEGORY_BASE_SEVERITY = { medical: 4, water: 3.5, shelter: 3, food: 3, education: 1.5, clothing: 1.5, transport: 2, communication: 1.5, electricity: 2, financial: 1.5, logistics: 1.5 };
  severity = Math.max(severity, CATEGORY_BASE_SEVERITY[category] || 2);
  breakdown.severity = Math.min(5, severity);

  // Population impact score
  let pop = 1;
  if (peopleAffected > 10000) pop = 3;
  else if (peopleAffected > 5000) pop = 2.5;
  else if (peopleAffected > 1000) pop = 2;
  else if (peopleAffected > 500) pop = 1.5;
  else if (peopleAffected > 100) pop = 1.2;
  else if (peopleAffected > 0) pop = 1;
  breakdown.populationImpact = pop;

  // Time criticality score
  const TIME_CRITICAL = { medical: 2, water: 1.8, shelter: 1.6, food: 1.5, transport: 1, communication: 0.8, electricity: 1, financial: 0.5, clothing: 0.5, education: 0.3, logistics: 0.7 };
  let tc = TIME_CRITICAL[category] || 0.5;
  if (urgencyLevel === 'critical') tc = Math.min(2, tc * 1.3);
  else if (urgencyLevel === 'high') tc = Math.min(2, tc * 1.1);
  breakdown.timeCriticality = Math.round(tc * 10) / 10;

  const total = Math.round((breakdown.severity + breakdown.populationImpact + breakdown.timeCriticality) * 10) / 10;
  const label = total >= 8 ? 'critical' : total >= 6 ? 'high' : total >= 4 ? 'medium' : 'low';

  return { score: total, label, breakdown };
}

// Legacy wrapper — returns just the priority label
function detectNeedPriority(category, text, peopleAffected = 0, urgencyLevel = 'medium') {
  return computePriorityMatrix(category, text, peopleAffected, urgencyLevel).label;
}

/**
 * Generate a short, clear description for a need based on category + text context.
 */
function generateNeedDescription(category, text, location, peopleAffected) {
  const loc = location || 'the affected area';
  const count = peopleAffected > 0 ? `~${peopleAffected.toLocaleString()} people affected` : null;

  const templates = {
    water: () => {
      const borewellMatch = text.match(/(\d+)\s*borewells?/i);
      if (borewellMatch) return `${borewellMatch[1]} borewell(s) non-functional in ${loc}${count ? ` — ${count}` : ''}.`;
      return `Water supply disrupted in ${loc}${count ? ` — ${count}` : ''}.`;
    },
    medical: () => `Medical care needed in ${loc}${count ? ` — ${count}` : ''}. Symptoms include fever, diarrhea, and untreated injuries.`,
    food: () => `Food shortage reported in ${loc}${count ? ` — ${count}` : ''}. Ration supplies running low.`,
    shelter: () => `Displaced residents in ${loc} require emergency shelter${count ? ` — ${count}` : ''}.`,
    education: () => {
      const studentsMatch = text.match(/(\d+)\s*students?/i);
      const count2 = studentsMatch ? `${studentsMatch[1]} students` : (count || 'students');
      return `School supplies urgently needed in ${loc} — ${count2} lack basic learning materials.`;
    },
    clothing: () => `Clothing and blankets needed for displaced people in ${loc}${count ? ` — ${count}` : ''}.`,
    transport: () => `Road/transport access blocked or severly limited in ${loc}.`,
    communication: () => `Communication networks disrupted in ${loc}.`,
    electricity: () => `Power outage in ${loc} affecting essential services.`,
    financial: () => `Financial relief required for affected families in ${loc}${count ? ` — ${count}` : ''}.`,
    logistics: () => `Supply logistics and distribution support needed in ${loc}.`,
  };

  return (templates[category] || (() => `${CATEGORY_LABELS[category] || category} need identified in ${loc}${count ? ` — ${count}` : ''}.`))();
}

// ── System Prompt for LLM ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert AI system for analyzing humanitarian field reports and extracting MULTIPLE structured community needs.

CRITICAL: You MUST identify ALL distinct need types present in the report — do NOT collapse them into one.
The report may be messy, use abbreviations, or mix Hindi/English — handle gracefully.

Return ONLY valid JSON in this EXACT format:

{
  "needs": [
    {
      "category": "water | medical | education | food | shelter | clothing | transport | communication | electricity | financial | logistics",
      "description": "Clear 1-sentence description of the specific need with context",
      "peopleAffected": 0,
      "priority": "critical | high | medium | low",
      "priorityScore": 0.0,
      "confidence": 0.0,
      "evidenceSignals": ["e.g. borewell non-functional", "3 borewells mentioned"]
    }
  ],
  "meta": {
    "location": "most specific location string from the text",
    "riskScore": 0.0,
    "urgencyLevel": "critical | high | medium | low",
    "affectedPeopleTotal": 0,
    "summary": "1-2 sentence professional crisis brief",
    "confidence_score": 0.0,
    "_extraction_method": "llm",
    "_reasoning": {
      "location": "",
      "urgency_level": "",
      "needs": "",
      "affected_people_estimate": ""
    }
  }
}

EXTRACTION RULES:

1. NEEDS (MOST IMPORTANT):
   - Identify EVERY distinct need type in the report — water, medical, food, shelter, education, etc.
   - Each need gets its OWN object in the array
   - description: 1 sentence, specific, actionable (e.g. "3 borewells non-functional in Rajpur village — ~4200 people without water")
   - peopleAffected: extract the number specific to THIS need if mentioned (e.g. "1800 need medical help" → 1800). Use 0 if not mentioned.
   - priority: critical (mass-casualty/life-threatening), high (urgent but stable), medium (important), low (non-urgent)
   - priorityScore: 1-10 scale reflecting severity × population × time-criticality. E.g. water cut-off for 4200 = 9.0, school supplies = 3.5
   - confidence: evidence strength 0-1. 0.9+ = explicit text evidence; 0.7-0.9 = strong inference; 0.5-0.7 = weak signal; <0.5 = uncertain
   - evidenceSignals: list of 2-4 brief strings quoting the key evidence phrases from the report

2. LOCATION: Most specific place name mentioned. Empty string if none.

3. riskScore: 1-10 scale. 9-10 = mass casualties/critical. 7-8 = severe. 5-6 = moderate. 1-4 = low.

4. affectedPeopleTotal: The LARGEST/most relevant number of people affected (overall).

5. confidence_score: Overall extraction confidence (same 0-1 scale).

EXAMPLE INPUT: "Severe flooding in Rajpur village... 4200 affected... 3 borewells not working... 1800 need medical help... schools lack supplies"

EXAMPLE OUTPUT needs array:
[
  { "category": "water", "description": "3 borewells non-functional in Rajpur village — ~4200 residents without water", "peopleAffected": 4200, "priority": "critical", "priorityScore": 9.0, "confidence": 0.95, "evidenceSignals": ["3 borewells not working", "4200 affected", "severe flooding"] },
  { "category": "medical", "description": "1800 people need immediate medical attention — fever and injury cases reported", "peopleAffected": 1800, "priority": "high", "priorityScore": 7.5, "confidence": 0.92, "evidenceSignals": ["1800 need medical help"] },
  { "category": "education", "description": "Schools in Rajpur village lack basic supplies for students", "peopleAffected": 0, "priority": "medium", "priorityScore": 3.5, "confidence": 0.80, "evidenceSignals": ["schools lack supplies"] }
]

RULES:
- Return ONLY JSON — no markdown, no explanation outside JSON
- NEVER return an empty needs array if any humanitarian keywords are present
- Handle Hindi/transliterated words (paani=water, khana=food, bijli=electricity, ilaaj=medical)
- Handle abbreviations: ppl=people, dist=district, immd=immediate, med=medical
- Do NOT hallucinate numbers; if specific count not mentioned for a need, use 0
- Keep descriptions concise and actionable (under 140 chars)`;

// ── LLM Provider Calls ─────────────────────────────────────────────────────

async function analyzeWithClaude(text) {
  if (!config.claudeApiKey) throw new Error('CLAUDE_API_KEY not configured');

  // Pre-process: expand abbreviations + transliterations before sending to LLM
  const processedText = preprocessText(text);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.claudeApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.claudeModel,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze this humanitarian field report and extract ALL distinct community needs:\n\n${processedText}` }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text || '';
  const parsed = JSON.parse(cleanJson(rawText));
  return { parsed, provider: 'llm_claude' };
}

async function analyzeWithGemini(text) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');

  // Pre-process: expand abbreviations + transliterations before sending to LLM
  const processedText = preprocessText(text);

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `\n\nAnalyze this humanitarian field report and extract ALL distinct community needs:\n\n${processedText}` },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
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
  const parsed = JSON.parse(cleanJson(rawText));
  return { parsed, provider: 'llm_gemini' };
}

// ── Validation & Normalisation ─────────────────────────────────────────────

/**
 * Validate and normalise a single need object to the canonical contract.
 * Passes through scoring breakdowns for UI display.
 */
function normalizeNeed(item = {}) {
  const category = VALID_CATEGORIES.includes(String(item.category || '').toLowerCase())
    ? String(item.category).toLowerCase()
    : 'logistics';

  const priority = VALID_PRIORITIES.includes(String(item.priority || '').toLowerCase())
    ? String(item.priority).toLowerCase()
    : 'medium';

  const peopleAffected = typeof item.peopleAffected === 'number'
    ? Math.max(0, Math.round(item.peopleAffected))
    : parseNumber(item.peopleAffected);

  const confidence = typeof item.confidence === 'number'
    ? Math.round(Math.min(1, Math.max(0, item.confidence)) * 100) / 100
    : (item._confidenceResult?.score ?? 0.5);

  const description = typeof item.description === 'string' && item.description.trim()
    ? item.description.trim()
    : `${CATEGORY_LABELS[category] || category} need identified.`;

  // Pass through scoring breakdowns if present (generated by fallback path)
  const priorityScore    = typeof item.priorityScore === 'number' ? item.priorityScore : null;
  const priorityBreakdown = item.priorityBreakdown || null;
  const confidenceBreakdown = item.confidenceBreakdown || item._confidenceResult?.breakdown || null;
  const evidenceSignals   = item.evidenceSignals || null;

  return {
    category, description, peopleAffected, priority, confidence,
    ...(priorityScore    !== null ? { priorityScore }    : {}),
    ...(priorityBreakdown !== null ? { priorityBreakdown } : {}),
    ...(confidenceBreakdown !== null ? { confidenceBreakdown } : {}),
    ...(evidenceSignals  !== null ? { evidenceSignals }  : {}),
  };
}

/**
 * Build the full normalized result from an LLM-parsed object.
 */
function normalizeFromLLM(parsed, provider) {
  const needsRaw = Array.isArray(parsed.needs) ? parsed.needs : [];
  const needs = needsRaw.map(normalizeNeed).slice(0, 8);

  const meta = parsed.meta || {};
  const location = typeof meta.location === 'string' ? meta.location.trim() : '';
  const riskScore = typeof meta.riskScore === 'number'
    ? Math.round(Math.min(10, Math.max(0, meta.riskScore)) * 10) / 10
    : 5;
  const urgencyLevel = ['critical', 'high', 'medium', 'low'].includes(meta.urgencyLevel)
    ? meta.urgencyLevel : 'medium';
  const affectedPeopleTotal = typeof meta.affectedPeopleTotal === 'number'
    ? Math.max(0, Math.round(meta.affectedPeopleTotal)) : 0;
  const summary = typeof meta.summary === 'string' ? meta.summary.trim() : '';
  const confidence_score = typeof meta.confidence_score === 'number'
    ? Math.round(Math.min(1, Math.max(0, meta.confidence_score)) * 100) / 100
    : 0.7;

  return {
    // ── New contract ──
    needs,
    meta: { location, riskScore },
    // ── Legacy fields (backward-compat) ──
    location,
    urgency_level: urgencyLevel,
    needs_legacy: needs.map(n => ({ type: n.category, priority: n.priority })),
    affected_people_estimate: affectedPeopleTotal,
    summary,
    confidence_score,
    _extraction_method: provider,
    _reasoning: meta._reasoning || {},
  };
}

// ── Fallback Heuristic Extraction ──────────────────────────────────────────

/**
 * Pure keyword + regex + priority-matrix extraction — used when all LLM providers fail.
 * Returns the same shape as the LLM path, with full scoring breakdowns.
 */
function fallbackExtraction(text) {
  console.log('[NeedsExtractor] fallback: input text length =', text.length);
  console.log('[NeedsExtractor] fallback: first 300 chars:', text.slice(0, 300));

  const normalized  = normalizeText(text); // includes preprocessText()
  const sentences   = splitSentences(normalized);

  // 1. Location
  const location    = extractLocationWithKeywords(normalized);
  const hasLocation = !!location;

  // 2. Overall urgency
  const urgency = extractUrgencyWithKeywords(normalized);

  // 3. Global affected count
  const globalCount = extractGlobalAffectedCount(normalized);

  // 4. Detect which need categories are present (using fulltext for context)
  const detectedCategories = [];
  for (const [category, pattern] of Object.entries(NEEDS_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) detectedCategories.push(category);
  }

  console.log('[NeedsExtractor] fallback: detected categories =', detectedCategories);

  // 5. Build rich need objects with priority matrix + confidence breakdown
  const rawNeeds = detectedCategories.slice(0, 8).map(category => {
    // Sentence-window scoped people count
    const peopleAffected = extractPerNeedPeopleCount(normalized, category, globalCount);

    // Priority matrix (severity × population × time-criticality)
    const priorityResult = computePriorityMatrix(category, normalized, peopleAffected, urgency);

    // Multi-signal confidence
    const confidenceResult = computeNeedConfidence(category, normalized, peopleAffected > 0, hasLocation);

    // Collect evidence signals (what triggered detection)
    const evidenceSignals = [];
    const strongPat = STRONG_EVIDENCE_PATTERNS[category];
    if (strongPat) {
      strongPat.lastIndex = 0;
      const matches = normalized.match(strongPat);
      if (matches) evidenceSignals.push(...matches.slice(0, 2).map(m => m.trim()));
    }
    if (peopleAffected > 0) evidenceSignals.push(`${peopleAffected.toLocaleString()} people affected`);
    if (urgency === 'critical' || urgency === 'high') evidenceSignals.push(`${urgency} urgency`);

    const description = generateNeedDescription(category, normalized, location, peopleAffected);

    return normalizeNeed({
      category,
      description,
      peopleAffected,
      priority:            priorityResult.label,
      priorityScore:       priorityResult.score,
      priorityBreakdown:   priorityResult.breakdown,
      confidence:          confidenceResult.score,
      confidenceBreakdown: confidenceResult.breakdown,
      evidenceSignals:     evidenceSignals.slice(0, 4),
      _confidenceResult:   confidenceResult,
    });
  });

  // Sort: critical > high > medium > low, then by priorityScore desc
  const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  rawNeeds.sort((a, b) => {
    const pDiff = (ORDER[a.priority] ?? 4) - (ORDER[b.priority] ?? 4);
    return pDiff !== 0 ? pDiff : (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
  });

  // 6. Overall risk score — weighted by top need's priority matrix
  const topPriScore = rawNeeds[0]?.priorityScore ?? 0;
  const riskScore = Math.min(10, Math.round((topPriScore * 0.6 + (rawNeeds.length > 2 ? 2 : rawNeeds.length)) * 10) / 10);

  // 7. Overall extraction confidence
  const avgConf = rawNeeds.length > 0
    ? rawNeeds.reduce((s, n) => s + (n.confidence || 0), 0) / rawNeeds.length
    : 0;
  const confidence_score = Math.round(Math.min(0.9, avgConf) * 100) / 100;

  // 8. Generate summary
  const eventPatterns = [
    { p: /\b(flood|flooding|heavy rain|waterlog|inundat)\b/gi,  label: 'flood' },
    { p: /\b(fire|burning|blaze)\b/gi,                            label: 'fire' },
    { p: /\b(earthquake|quake|tremor)\b/gi,                       label: 'earthquake' },
    { p: /\b(cyclone|storm|hurricane|typhoon)\b/gi,               label: 'cyclone' },
    { p: /\b(drought|water shortage|sukha)\b/gi,                  label: 'drought' },
    { p: /\b(landslide|mudslide)\b/gi,                            label: 'landslide' },
    { p: /\b(outbreak|epidemic|disease spread)\b/gi,              label: 'disease outbreak' },
  ];
  let eventType = 'incident';
  for (const { p, label } of eventPatterns) {
    if (p.test(text)) { eventType = label; break; }
  }

  const locStr    = location || 'the affected area';
  const impactStr = globalCount > 0 ? `${globalCount.toLocaleString()} people affected` : 'residents affected';
  const summary   = `A ${urgency === 'critical' ? 'critical' : urgency === 'high' ? 'high-severity' : 'moderate'} ${eventType} in ${locStr} has left ${impactStr}. Immediate response needed for: ${rawNeeds.slice(0, 3).map(n => n.category).join(', ')}.`;

  const result = {
    needs: rawNeeds,
    meta: { location, riskScore },
    location,
    urgency_level: urgency,
    needs_legacy: rawNeeds.map(n => ({ type: n.category, priority: n.priority })),
    affected_people_estimate: globalCount,
    summary,
    confidence_score,
    _extraction_method: 'keyword_fallback',
    _reasoning: {
      location:                  location ? `Extracted "${location}" via pattern matching` : 'No location found',
      urgency_level:             `Assigned "${urgency}" urgency (${Object.keys(URGENCY_PATTERNS).join('>')} scan)`,
      needs:                     `Detected ${rawNeeds.length} categories: ${detectedCategories.join(', ')}`,
      affected_people_estimate:  globalCount > 0 ? `Global count: ${globalCount}` : 'No count found',
    },
  };

  console.log('[NeedsExtractor] fallback: extracted needs =', JSON.stringify(rawNeeds.map(n => ({ category: n.category, priority: n.priority, priorityScore: n.priorityScore, confidence: n.confidence, peopleAffected: n.peopleAffected })), null, 2));
  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract MULTIPLE structured needs from raw disaster report text.
 * This is the primary extraction function — provider chain: Claude → Gemini → keyword fallback.
 *
 * @param {string} text - Raw report text
 * @returns {Promise<NeedObject[]>} Array of { category, description, peopleAffected, priority, confidence }
 */
export async function extractNeedsFromText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    console.warn('[NeedsExtractor] extractNeedsFromText: empty input');
    return [];
  }

  console.log('[NeedsExtractor] extractNeedsFromText: input length =', text.length);
  console.log('[NeedsExtractor] extractNeedsFromText: first 200 chars:', text.slice(0, 200));

  const result = await analyzeReport(text);

  console.log('[NeedsExtractor] extractNeedsFromText: extracted', result.needs.length, 'needs');
  console.log('[NeedsExtractor] extractNeedsFromText: needs =', JSON.stringify(result.needs, null, 2));

  return result.needs;
}

/**
 * Full report analysis — returns needs[] + meta + legacy fields.
 * Provider chain: Claude → Gemini → keyword fallback.
 *
 * @param {string} reportText
 * @param {Object} options
 * @param {boolean} [options.useLLM=true]
 * @returns {Promise<Object>}
 */
export async function analyzeReport(reportText, options = {}) {
  if (!reportText || typeof reportText !== 'string') {
    throw new Error('Report text is required and must be a string');
  }
  const trimmed = reportText.trim();
  if (!trimmed) throw new Error('Report text cannot be empty');
  if (trimmed.length > 50000) throw new Error('Report text exceeds maximum length of 50000 characters');

  console.log('[NeedsExtractor] analyzeReport: input text (first 300 chars):', trimmed.slice(0, 300));

  const useLLM = options.useLLM !== false && (config.claudeApiKey || config.geminiApiKey);

  if (useLLM) {
    if (config.claudeApiKey) {
      try {
        console.log('[NeedsExtractor] analyzeReport: trying Claude...');
        const { parsed, provider } = await analyzeWithClaude(trimmed);
        const result = normalizeFromLLM(parsed, provider);
        console.log('[NeedsExtractor] analyzeReport: Claude success, needs count =', result.needs.length);
        console.log('[NeedsExtractor] analyzeReport: needs =', JSON.stringify(result.needs, null, 2));
        return result;
      } catch (err) {
        console.warn('[NeedsExtractor] Claude failed, trying Gemini:', err.message);
      }
    }

    if (config.geminiApiKey) {
      try {
        console.log('[NeedsExtractor] analyzeReport: trying Gemini...');
        const { parsed, provider } = await analyzeWithGemini(trimmed);
        const result = normalizeFromLLM(parsed, provider);
        console.log('[NeedsExtractor] analyzeReport: Gemini success, needs count =', result.needs.length);
        console.log('[NeedsExtractor] analyzeReport: needs =', JSON.stringify(result.needs, null, 2));
        return result;
      } catch (err) {
        console.warn('[NeedsExtractor] Gemini failed, using keyword fallback:', err.message);
      }
    }
  }

  console.log('[NeedsExtractor] analyzeReport: using keyword fallback');
  return fallbackExtraction(trimmed);
}

/**
 * Batch analyze multiple reports.
 *
 * @param {Array<{id: string, text: string}>} reports
 * @returns {Promise<Array<{id: string, result: Object, error: string|null}>>}
 */
export async function analyzeReportsBatch(reports) {
  if (!Array.isArray(reports)) throw new Error('Reports must be an array');

  return Promise.all(
    reports.map(async (report) => {
      try {
        const result = await analyzeReport(report.text);
        return { id: report.id, result, error: null };
      } catch (error) {
        return { id: report.id, result: null, error: error.message };
      }
    }),
  );
}

export default { analyzeReport, analyzeReportsBatch, extractNeedsFromText };
