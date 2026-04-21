export const ASSISTANT_MODES = {
  responder: {
    id: 'responder',
    label: 'Responder Mode',
    instruction:
      'Focus on immediate tactical actions, safety checks, and short step-by-step instructions for field responders.',
  },
  coordinator: {
    id: 'coordinator',
    label: 'Coordinator Mode',
    instruction:
      'Focus on triage, prioritization, resource balancing, and cross-team coordination decisions.',
  },
  citizen: {
    id: 'citizen',
    label: 'Citizen Mode',
    instruction:
      'Use calm, simple language. Provide personal safety guidance, nearest support actions, and reassurance.',
  },
};

export function getAssistantPromptByMode(mode = 'coordinator') {
  const selected = ASSISTANT_MODES[mode] || ASSISTANT_MODES.coordinator;
  return `Assistant mode: ${selected.label}. ${selected.instruction}`;
}

export function buildModeAwareFallback(mode, message) {
  if (mode === 'responder') {
    return `Field protocol: 1) Confirm scene safety, 2) Share exact GPS, 3) Start triage, 4) Request backup with resource count.\n\nYour query: "${message}"`;
  }
  if (mode === 'citizen') {
    return `Stay calm and move to a safer location first. Keep your phone charged, avoid rumors, and follow official alerts. If someone is injured, request emergency help immediately.\n\nI can also help draft a short report from your message.`;
  }
  return `Coordination view: prioritize high-risk zones first, then deploy available volunteers by skill and distance. Keep one reserve team for escalation.\n\nI can convert your message into an action plan if needed.`;
}
