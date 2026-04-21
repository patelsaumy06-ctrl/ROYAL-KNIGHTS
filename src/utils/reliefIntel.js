const URGENT_WORDS = ['urgent', 'critical', 'emergency'];
const FOOD_WORDS = ['food', 'hungry'];
const MEDICAL_WORDS = ['doctor', 'injury', 'hospital', 'medical'];
const SHELTER_WORDS = ['home', 'shelter'];

export function analyzeReport(text) {
  const t = String(text || '').toLowerCase();
  let score = 20;
  let category = 'Other';

  const urgentCount = URGENT_WORDS.filter(w => t.includes(w)).length;
  if (urgentCount > 0) score = Math.min(100, 80 + urgentCount * 8 + (t.includes('flood') || t.includes('fire') ? 5 : 0));
  if (FOOD_WORDS.some((w) => t.includes(w))) category = 'Food';
  if (MEDICAL_WORDS.some((w) => t.includes(w))) category = 'Medical';
  if (SHELTER_WORDS.some((w) => t.includes(w))) category = 'Shelter';

  if (!URGENT_WORDS.some((w) => t.includes(w))) {
    if (category === 'Medical') score = 65;
    else if (category === 'Shelter') score = 52;
    else if (category === 'Food') score = 45;
    else score = 30;
  }

  return { score: Math.max(0, Math.min(100, score)), category };
}
