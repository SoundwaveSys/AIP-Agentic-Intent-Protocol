/**
 * Cloud-AI intent extraction client.
 * The API key stays on the Express server; never put it in Vite variables.
 * The server returns a validated AIP-0.1 intent and an allowlisted agent plan.
 */
export async function parseIntent(command) {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("Please enter a valid instruction.");
  }

  const response = await fetch("/api/agent/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: command.trim() }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Jinni could not interpret this instruction.");
  }
  if (!data.intent || data.intent.version !== "AIP-0.1" || !Array.isArray(data.plan)) {
    throw new Error("Jinni received an invalid AIP intent response.");
  }

  if (data.intent.clarificationNeeded) {
    throw new Error(data.intent.clarificationQuestion || "Jinni needs clarification before proceeding.");
  }

  // Attach the advisory plan so the existing execution handler can run allowed steps.
  data.intent.executionPlan = data.plan;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("jinni:plan", { detail: { plan: data.plan, runId: data.runId } }));
  }
  return data.intent;
}
