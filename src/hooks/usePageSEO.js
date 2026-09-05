import { useEffect } from 'react';

export const PAGE_SEO_METADATA = {
  landing: {
    title: 'NeedLink AI — Humanitarian Crisis Response & Volunteer Coordination',
    description: 'AI-driven humanitarian crisis response platform. Aggregate scattered field reports, score emergency risks with Gemini AI, and auto-dispatch volunteers in real-time.',
    canonical: 'https://needlink-ai.web.app/',
  },
  dashboard: {
    title: 'Crisis Command Dashboard | NeedLink AI',
    description: 'Live overview of active humanitarian incidents, emergency risk score, response times, and AI triage summaries.',
    canonical: 'https://needlink-ai.web.app/dashboard',
  },
  map: {
    title: 'Live Crisis Hotspot Map & Geo-Dispatch | NeedLink AI',
    description: 'Interactive real-time map displaying disaster incidents, volunteer locations, risk clusters, and dynamic routing.',
    canonical: 'https://needlink-ai.web.app/map',
  },
  volunteers: {
    title: 'Volunteer Coordination & AI Matching | NeedLink AI',
    description: 'Intelligent volunteer matching by skill, proximity, and urgency. Fast-track emergency volunteer dispatch.',
    canonical: 'https://needlink-ai.web.app/volunteers',
  },
  insights: {
    title: 'Disaster Intelligence & Risk Forecasting | NeedLink AI',
    description: 'AI predictive analytics, early warning anomaly detection, and operational bottleneck recommendations.',
    canonical: 'https://needlink-ai.web.app/insights',
  },
  communityNeeds: {
    title: 'Community Needs & Field Requests | NeedLink AI',
    description: 'Track community relief requests, critical supply shortages, and ground surveys across affected zones.',
    canonical: 'https://needlink-ai.web.app/community-needs',
  },
  pipeline: {
    title: 'Crisis Response Pipeline & Triage | NeedLink AI',
    description: 'End-to-end incident pipeline from raw report ingestion to verification, assignment, and relief delivery.',
    canonical: 'https://needlink-ai.web.app/crisis-pipeline',
  },
  tasks: {
    title: 'Emergency Tasks & Dispatch Management | NeedLink AI',
    description: 'Manage prioritized relief tasks, assign field responders, and track resolution timelines.',
    canonical: 'https://needlink-ai.web.app/tasks',
  },
  reports: {
    title: 'Humanitarian Impact Reports & Analytics | NeedLink AI',
    description: 'Exportable situational reports, donor impact summaries, and operational relief statistics.',
    canonical: 'https://needlink-ai.web.app/reports',
  },
  upload: {
    title: 'Field Report Intake & Survey Upload | NeedLink AI',
    description: 'Upload field notes, survey CSVs, or scanned incident reports for automated AI extraction.',
    canonical: 'https://needlink-ai.web.app/upload',
  },
  auth: {
    title: 'NGO Portal Sign In | NeedLink AI',
    description: 'Secure sign in for humanitarian responders, relief NGOs, and disaster coordinators.',
    canonical: 'https://needlink-ai.web.app/auth',
  },
};

/**
 * Custom React hook to dynamically update document title, meta description,
 * Open Graph, and canonical URL on SPA route / page changes.
 *
 * @param {string} pageKey - Key identifying the active view/page
 * @param {object} [customOverride] - Optional custom title/description overrides
 */
export function usePageSEO(pageKey, customOverride = null) {
  useEffect(() => {
    const meta = customOverride || PAGE_SEO_METADATA[pageKey] || PAGE_SEO_METADATA.landing;

    // 1. Update Document Title
    if (meta.title) {
      document.title = meta.title;
    }

    // 2. Update Primary Description
    let descTag = document.querySelector('meta[name="description"]');
    if (descTag && meta.description) {
      descTag.setAttribute('content', meta.description);
    }

    // 3. Update Open Graph Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && meta.title) {
      ogTitle.setAttribute('content', meta.title);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && meta.description) {
      ogDesc.setAttribute('content', meta.description);
    }

    // 4. Update Open Graph URL & Canonical Link
    const canonicalUrl = meta.canonical || 'https://needlink-ai.web.app/';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', canonicalUrl);
    }

    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag) {
      canonicalTag.setAttribute('href', canonicalUrl);
    }
  }, [pageKey, customOverride]);
}
