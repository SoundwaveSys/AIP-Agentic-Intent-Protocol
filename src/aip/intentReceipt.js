
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

function resolveAuthorizationStatus(authorization) {
  const status =
    authorization.status ?? authorization.decision;

  // Support the new AIP decision model.
  if (["ALLOW", "REVIEW", "DENY"].includes(status)) {
    return status;
  }

  // Backward compatibility with the old authorization engine.
  if (typeof authorization.authorized === "boolean") {
    return authorization.authorized ? "ALLOW" : "DENY";
  }

  throw new Error(
    "Authorization must provide ALLOW, REVIEW, or DENY."
  );
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
    Array.isArray(authorization)
  ) {
    throw new Error(
      "A valid authorization result is required."
    );
  }

  if (!Array.isArray(authorization.checks)) {
    throw new Error(
      "Authorization checks must be provided as an array."
    );
  }

  const status = resolveAuthorizationStatus(authorization);

  // REVIEW is not authorization to execute.
  const authorized = status === "ALLOW";

  const receiptId = createReceiptId();
  const createdAt = new Date().toISOString();

  return {
    protocol: "AIP",
    version: "AIP-0.1",
    receiptId,
    createdAt,

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

    transaction: {
      id: transaction.id ?? null,

      name:
        transaction.name ??
        transaction.title ??
        "Unnamed transaction",

      category: transaction.category ?? null,
      price: transaction.price ?? null,
      priceText: transaction.priceText ?? null,
      currency: transaction.currency ?? null,
      agent: transaction.agent ?? null,

      useCases: cloneJsonValue(
        transaction.useCases ?? []
      ),

      specifications: cloneJsonValue(
        transaction.specifications ?? {}
      ),

      // Record whether specifications were marked verified.
      // This receipt field alone does not prove verification.
      specificationsVerified:
        transaction.specificationsVerified === true,

      details: cloneJsonValue(
        transaction.details ?? null
      ),

      source: transaction.source ?? null,
      store: transaction.store ?? null,
      url: transaction.url ?? null,
    },

    authorization: {
      status,
      decision: status,
      authorized,

      checks: cloneJsonValue(authorization.checks),

      reasons: cloneJsonValue(
        authorization.reasons ?? []
      ),
    },
  };
}
