
const SUPPORTED_VERSIONS = ["AIP-0.1"];

const SUPPORTED_PURPOSES = [
  "purchase",
  "planning",
];

const SUPPORTED_CATEGORIES = [
  "laptop",
  "desktop_cpu",
  "computer",
  "shoes",
  "phone",
  "audio",
  "watch",
  "travel",
  "gift",
  "unknown",
];

const SUPPORTED_CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
];

const SUPPORTED_AGENTS = [
  "jinni",
];

const SUPPORTED_PROCESSOR_BRANDS = [
  "Intel",
  "AMD",
];

const SUPPORTED_STORAGE_TYPES = [
  "SSD",
  "HDD",
];

export function validateIntent(intent) {
  const errors = [];

  // -------------------------
  // Basic object validation
  // -------------------------

  if (
    !intent ||
    typeof intent !== "object" ||
    Array.isArray(intent)
  ) {
    return {
      valid: false,
      errors: ["Intent must be an object."],
    };
  }

  // -------------------------
  // Version
  // -------------------------

  if (!SUPPORTED_VERSIONS.includes(intent.version)) {
    errors.push(`Unsupported AIP version: ${intent.version}`);
  }

  // -------------------------
  // Purpose
  // -------------------------

  if (!SUPPORTED_PURPOSES.includes(intent.purpose)) {
    errors.push(`Invalid purpose: ${intent.purpose}`);
  }

  // -------------------------
  // Category
  // -------------------------

  if (!SUPPORTED_CATEGORIES.includes(intent.category)) {
    errors.push(`Invalid category: ${intent.category}`);
  }

  if (
    intent.category === "unknown" &&
    typeof intent.rawCommand === "string"
  ) {
    errors.push(
      "Could not identify the product or service category. Please clarify your instruction."
    );
  }

  // -------------------------
  // Currency
  // -------------------------

  if (!SUPPORTED_CURRENCIES.includes(intent.currency)) {
    errors.push(`Unsupported currency: ${intent.currency}`);
  }

  // -------------------------
  // Requester
  // -------------------------

  if (intent.requestedBy !== "human") {
    errors.push("Intent must originate from a human.");
  }

  // -------------------------
  // Agent
  // -------------------------

  if (!SUPPORTED_AGENTS.includes(intent.agent)) {
    errors.push(`Unauthorized agent: ${intent.agent}`);
  }

  // -------------------------
  // Original instruction
  // -------------------------

  if (
    typeof intent.rawCommand !== "string" ||
    !intent.rawCommand.trim()
  ) {
    errors.push("Original user instruction is required.");
  }

  // -------------------------
  // Budget
  // -------------------------

  if (
    !intent.budget ||
    typeof intent.budget !== "object" ||
    Array.isArray(intent.budget)
  ) {
    errors.push("Budget object is required.");
  } else {
    const maximum = intent.budget.maximum;

    if (
      maximum !== null &&
      (
        typeof maximum !== "number" ||
        !Number.isFinite(maximum)
      )
    ) {
      errors.push("Budget maximum must be a valid finite number.");
    }

    if (
      typeof maximum === "number" &&
      maximum <= 0
    ) {
      errors.push("Budget maximum must be greater than zero.");
    }

    if (
      intent.budget.currency !== intent.currency
    ) {
      errors.push(
        "Budget currency must match intent currency."
      );
    }
  }

  // -------------------------
  // Use case
  // -------------------------

  if (
    intent.useCase !== null &&
    intent.useCase !== undefined &&
    (
      typeof intent.useCase !== "string" ||
      !intent.useCase.trim()
    )
  ) {
    errors.push("Use case must be a non-empty string or null.");
  }

  // -------------------------
  // Product requirements
  // -------------------------

  if (
    intent.requirements !== undefined &&
    (
      !intent.requirements ||
      typeof intent.requirements !== "object" ||
      Array.isArray(intent.requirements)
    )
  ) {
    errors.push("Requirements must be an object.");
  }

  const requirements = intent.requirements;

  if (
    requirements &&
    typeof requirements === "object" &&
    !Array.isArray(requirements)
  ) {
    if (
      requirements.processorBrand !== undefined &&
      !SUPPORTED_PROCESSOR_BRANDS.includes(
        requirements.processorBrand
      )
    ) {
      errors.push(
        `Unsupported processor brand: ${requirements.processorBrand}`
      );
    }

    if (
      requirements.processorFamily !== undefined &&
      (
        typeof requirements.processorFamily !== "string" ||
        !requirements.processorFamily.trim()
      )
    ) {
      errors.push("Processor family must be a non-empty string.");
    }

    if (
      requirements.processorGeneration !== undefined &&
      (
        !Number.isInteger(requirements.processorGeneration) ||
        requirements.processorGeneration <= 0
      )
    ) {
      errors.push(
        "Processor generation must be a positive integer."
      );
    }

    if (
      requirements.ramGb !== undefined &&
      (
        typeof requirements.ramGb !== "number" ||
        !Number.isFinite(requirements.ramGb) ||
        requirements.ramGb <= 0
      )
    ) {
      errors.push("RAM capacity must be a positive number.");
    }

    if (requirements.storage !== undefined) {
      const storage = requirements.storage;

      if (
        !storage ||
        typeof storage !== "object" ||
        Array.isArray(storage)
      ) {
        errors.push("Storage requirement must be an object.");
      } else {
        if (
          typeof storage.capacityGb !== "number" ||
          !Number.isFinite(storage.capacityGb) ||
          storage.capacityGb <= 0
        ) {
          errors.push(
            "Storage capacity must be a positive number in GB."
          );
        }

        if (
          storage.type !== null &&
          storage.type !== undefined &&
          !SUPPORTED_STORAGE_TYPES.includes(storage.type)
        ) {
          errors.push(
            `Unsupported storage type: ${storage.type}`
          );
        }
      }
    }

    if (
      requirements.graphicsCard !== undefined &&
      (
        typeof requirements.graphicsCard !== "string" ||
        !requirements.graphicsCard.trim()
      )
    ) {
      errors.push("Graphics card must be a non-empty string.");
    }
  }

  // -------------------------
  // Final result
  // -------------------------

  return {
    valid: errors.length === 0,
    errors,
  };
}
