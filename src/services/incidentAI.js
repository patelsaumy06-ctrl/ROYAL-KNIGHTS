export async function analyzeIncidentReport(reportText, options = {}) {
  const response = await fetch("/api/ai/incident-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportText,
      provider: options.provider || "gemini",
      context: options.context || {},
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Unable to analyze report text.");
  }
  return payload;
}

export function urgencyToPriority(urgencyLevel = "medium") {
  const normalized = String(urgencyLevel).toLowerCase();
  if (normalized === "critical" || normalized === "high") return "urgent";
  if (normalized === "low") return "low";
  return "medium";
}
