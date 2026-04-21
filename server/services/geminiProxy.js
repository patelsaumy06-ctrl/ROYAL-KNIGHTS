/**
 * Secure Gemini proxy for document / survey parsing.
 *
 * Moved from src/services/gemini.js so the API key
 * never touches the client bundle.
 */
import config from '../config.js';

const SYSTEM_PROMPT = `You are an AI assistant helping NGOs in Gujarat, India analyze community survey data.
Your job is to read the provided file content and extract structured community needs.
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation, just the JSON:
{
  "village": "Village or area name",
  "region": "District name (e.g. Mehsana, Patan, Banaskantha, Gandhinagar)",
  "totalRecords": 142,
  "summary": "One sentence summary of what this data contains",
  "needs": [
    {
      "category": "Category name (e.g. Water Crisis, Medical Camp, Food Shortage, Flood Relief, Sanitation, School Supplies, Drought Aid)",
      "priority": "urgent | medium | low",
      "volunteersNeeded": 8,
      "description": "Specific description of the need in 1-2 sentences",
      "affectedPeople": 4200,
      "deadline": "YYYY-MM-DD"
    }
  ],
  "aiInsights": [
    "Key insight 1 about this community needs",
    "Key insight 2",
    "Key insight 3"
  ]
}
Rules:
- Extract ALL distinct community needs from the data
- Assign urgent priority if: crisis, emergency, critical, no access, flooding, drought
- Assign medium priority if: shortage, need, required, lacking
- Assign low priority if: improvement, enhancement, would like, optional
- volunteersNeeded should be realistic (2-20 based on severity)
- deadline: set 3-14 days from today based on urgency`;

function cleanJson(text = '') {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

/**
 * Parse a document via Gemini and return structured needs.
 *
 * @param {string} fileContent  Raw text or base64-encoded binary
 * @param {string} fileType     MIME type or "text"
 * @param {string} fileName     Original filename for context
 * @returns {Promise<object>}   Parsed community needs object
 */
export async function parseDocument(fileContent, fileType, fileName) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

  let parts = [];
  if (fileType === 'text') {
    parts = [
      { text: SYSTEM_PROMPT },
      { text: `\n\nFile name: ${fileName}\n\nFile content:\n${fileContent}` },
    ];
  } else {
    const mimeMap = {
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/jpg': 'image/jpeg',
      'application/pdf': 'application/pdf',
    };
    parts = [
      { text: SYSTEM_PROMPT },
      { text: `\n\nFile name: ${fileName}\n\nAnalyze this document and extract community needs:` },
      { inlineData: { mimeType: mimeMap[fileType] || 'image/jpeg', data: fileContent } },
    ];
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
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
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini returned invalid JSON: ' + rawText.slice(0, 200));
  }
}
