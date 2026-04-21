/**
 * Semantic Skill Ontology
 *
 * Replaces naive string-includes matching with a structured skill graph.
 * Each cluster has a canonical name, synonyms (exact match = full credit),
 * and related terms (partial match = 0.5 credit).
 *
 * IDF weights reflect rarity — specialized skills score higher when matched.
 */

export const SKILL_CLUSTERS = [
    {
        canonical: 'medical',
        idfWeight: 1.6,
        synonyms: ['doctor', 'physician', 'nurse', 'emt', 'paramedic', 'medic', 'first aid', 'cpr', 'triage', 'healthcare', 'clinical', 'health worker'],
        related: ['biology', 'pharmacist', 'dentist', 'midwife', 'counselor'],
    },
    {
        canonical: 'rescue',
        idfWeight: 1.5,
        synonyms: ['search and rescue', 'sar', 'swift water rescue', 'rope rescue', 'firefighter', 'fire rescue', 'rappel', 'water rescue'],
        related: ['swimming', 'diving', 'climbing', 'navigation'],
    },
    {
        canonical: 'logistics',
        idfWeight: 1.0,
        synonyms: ['supply chain', 'inventory', 'distribution', 'transport', 'driver', 'delivery', 'warehouse', 'procurement'],
        related: ['planning', 'coordination', 'management', 'admin'],
    },
    {
        canonical: 'engineering',
        idfWeight: 1.4,
        synonyms: ['civil engineer', 'structural engineer', 'construction', 'electrician', 'plumber', 'mechanic', 'technician', 'repair'],
        related: ['carpentry', 'welding', 'surveying', 'architecture'],
    },
    {
        canonical: 'communication',
        idfWeight: 0.9,
        synonyms: ['radio operator', 'ham radio', 'interpreter', 'translator', 'public relations', 'media', 'journalism', 'social media'],
        related: ['language', 'bilingual', 'reporting', 'documentation'],
    },
    {
        canonical: 'mental_health',
        idfWeight: 1.7,
        synonyms: ['psychologist', 'psychiatrist', 'therapist', 'counselor', 'social worker', 'grief support', 'trauma counseling'],
        related: ['social work', 'community outreach', 'wellbeing'],
    },
    {
        canonical: 'water_sanitation',
        idfWeight: 1.5,
        synonyms: ['wash', 'water purification', 'sanitation', 'hygiene', 'water supply', 'pumping', 'borehole'],
        related: ['plumbing', 'civil engineer', 'environmental'],
    },
    {
        canonical: 'food_distribution',
        idfWeight: 1.1,
        synonyms: ['food aid', 'nutrition', 'feeding program', 'kitchen', 'cook', 'catering', 'food security'],
        related: ['logistics', 'agriculture', 'farming'],
    },
    {
        canonical: 'shelter',
        idfWeight: 1.2,
        synonyms: ['camp management', 'shelter management', 'nfi', 'non-food items', 'housing', 'settlement'],
        related: ['construction', 'logistics', 'community management'],
    },
    {
        canonical: 'education',
        idfWeight: 0.9,
        synonyms: ['teacher', 'educator', 'trainer', 'facilitator', 'child protection', 'school'],
        related: ['community outreach', 'youth work', 'literacy'],
    },
    {
        canonical: 'data_management',
        idfWeight: 1.3,
        synonyms: ['data entry', 'database', 'gis', 'mapping', 'survey', 'monitoring', 'evaluation', 'm&e', 'reporting', 'analytics'],
        related: ['excel', 'kobo', 'powerbi', 'statistics'],
    },
    {
        canonical: 'driving',
        idfWeight: 0.8,
        synonyms: ['driver', '4x4', 'truck driver', 'motorcyclist', 'boat operator', 'vehicle', 'transport'],
        related: ['logistics', 'delivery'],
    },
    {
        canonical: 'security',
        idfWeight: 1.3,
        synonyms: ['security officer', 'guard', 'risk assessment', 'safety', 'police', 'crowd control'],
        related: ['military', 'law enforcement'],
    },
];

/** Build a flat lookup: token → { cluster, type: 'synonym'|'related', idfWeight } */
const _lookup = new Map();

for (const cluster of SKILL_CLUSTERS) {
    for (const token of cluster.synonyms) {
        _lookup.set(token.toLowerCase(), { cluster: cluster.canonical, type: 'synonym', idfWeight: cluster.idfWeight });
    }
    for (const token of cluster.related) {
        _lookup.set(token.toLowerCase(), { cluster: cluster.canonical, type: 'related', idfWeight: cluster.idfWeight });
    }
    // canonical maps to itself
    _lookup.set(cluster.canonical.toLowerCase(), { cluster: cluster.canonical, type: 'synonym', idfWeight: cluster.idfWeight });
}

/**
 * Resolve a raw skill string to its cluster entry (if any).
 * Returns the best match by checking exact token first, then substring.
 * @param {string} raw
 * @returns {{ cluster: string, type: string, idfWeight: number }|null}
 */
export function resolveSkill(raw) {
    const token = String(raw || '').toLowerCase().trim();
    if (!token) return null;

    // Exact match first
    if (_lookup.has(token)) return _lookup.get(token);

    // Substring: the raw token contains a known key, or vice versa
    for (const [key, entry] of _lookup.entries()) {
        if (token.includes(key) || key.includes(token)) return entry;
    }

    return null;
}

/**
 * Semantic skill score (0-100) between volunteer skills and required skills.
 *
 * Scoring rules per required skill:
 *  - Synonym/canonical match → 1.0  × idfWeight
 *  - Related cluster match  → 0.5  × idfWeight
 *  - No match               → 0.0
 *
 * Final score is normalised by total possible idfWeight.
 *
 * @param {string[]} volunteerSkillsRaw
 * @param {string[]} requiredSkillsRaw
 * @returns {number} 0–100
 */
export function semanticSkillScore(volunteerSkillsRaw, requiredSkillsRaw) {
    const volRaw = Array.isArray(volunteerSkillsRaw) ? volunteerSkillsRaw : [volunteerSkillsRaw];
    const reqRaw = Array.isArray(requiredSkillsRaw) ? requiredSkillsRaw : [requiredSkillsRaw];

    // Resolve volunteer skills to cluster entries
    const volResolved = volRaw.map(resolveSkill).filter(Boolean);

    if (reqRaw.filter(Boolean).length === 0) return 50; // No requirements — neutral
    if (volResolved.length === 0) return 0;

    let earned = 0;
    let possible = 0;

    for (const reqRawItem of reqRaw) {
        if (!reqRawItem) continue;
        const reqEntry = resolveSkill(reqRawItem);
        const idf = reqEntry?.idfWeight ?? 1.0;
        possible += idf;

        // Check if any volunteer skill matches this requirement's cluster
        const hit = volResolved.find((v) => v.cluster === reqEntry?.cluster);

        if (!hit) {
            // Last resort: raw substring match (unresolved skills)
            const reqToken = String(reqRawItem).toLowerCase();
            const rawHit = volRaw.some((v) => {
                const vt = String(v || '').toLowerCase();
                return vt.includes(reqToken) || reqToken.includes(vt);
            });
            if (rawHit) earned += 0.4 * idf;
            continue;
        }

        if (hit.type === 'synonym') {
            earned += 1.0 * idf;
        } else if (hit.type === 'related') {
            earned += 0.55 * idf;
        }
    }

    if (possible === 0) return 50;
    return Math.round((earned / possible) * 100);
}