
function createReceiptId() {
  if (
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  throw new Error(
    "Secure UUID generation is unavailable in this environment."
  );
}

function cloneJsonValue(value) {
  if (value === undefined) return null;

  // Receipt fields should contain JSON-compatible data.
  return JSON.parse(JSON.stringify(value));
}

export function createIntentReceipt(
  intent,
  transaction,
  authorization
) {
  if (
    !intent ||
    typeof intent !== "object" ||
    Array.isArray(intent)
  ) {
    throw new Error("A valid AIP intent is required.");
  }

  if (
    !transaction ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    throw new Error("A valid transaction is required.");
  }

  if (
    !authorization ||
    typeof authorization !== "object" ||
    typeof authorization.authorized !== "boolean"
  ) {
    throw new Error("A valid authorization result is required.");
  }

  if (!Array.isArray(authorization.checks)) {
    throw new Error(
      "Authorization checks must be provided as an array."
    );
  }

  const receiptId = createReceiptId();
  const createdAt = new Date().toISOString();

  const authorized = authorization.authorized;

  return {
    protocol: "AIP",
    version: "AIP-0.1",
    receiptId,
    createdAt,

    // Preserve the original intent and parsed requirements.
    intent: {
      rawCommand: intent.rawCommand ?? null,
      purpose: intent.purpose ?? null,
      category: intent.category ?? null,
      useCase: intent.useCase ?? null,
      requirements: cloneJsonValue(
        intent.requirements ?? {}
      ),
      budget: cloneJsonValue(intent.budget),
      currency: intent.currency ?? null,
      requestedBy: intent.requestedBy ?? null,
      agent: intent.agent ?? null,
      intentCreatedAt: intent.createdAt ?? null,
    },

    // Snapshot the transaction evaluated by the engine.
    transaction: {
      id: transaction.id ?? null,
      name:
        transaction.name ??
        transaction.title ??
        "Unnamed transaction",
      category: transaction.category ?? null,
      price: transaction.price ?? null,
      priceText: transaction.priceText ?? null,
      currency:
        transaction.currency ??
        null,
      agent: transaction.agent ?? null,
      useCases: cloneJsonValue(
        transaction.useCases ?? []
      ),
      specifications: cloneJsonValue(
        transaction.specifications ?? {}
      ),
      details: cloneJsonValue(
        transaction.details ?? null
      ),
      source: transaction.source ?? null,
      store: transaction.store ?? null,
      url: transaction.url ?? null,
    },

    // Record the exact decision and its supporting checks.
    authorization: {
      status: authorized ? "AUTHORIZED" : "DENIED",
      authorized,
      checks: cloneJsonValue(authorization.checks),
      reasons: cloneJsonValue(
        authorization.reasons ?? []
      ),
    },
  };
}
