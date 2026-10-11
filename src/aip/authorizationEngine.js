
export function authorizeTransaction(intent, transaction) {
  const checks = [];

  const addCheck = (
    name,
    passed,
    expected,
    actual,
    reason
  ) => {
    checks.push({
      name,
      passed,
      expected: expected ?? null,
      actual: actual ?? null,
      reason,
    });
  };

  const deny = (name, reason) => ({
    authorized: false,
    status: "DENIED",
    checks: [
      {
        name,
        passed: false,
        expected: null,
        actual: null,
        reason,
      },
    ],
    reasons: [reason],
  });

  // 1. Validate required objects.
  if (
    !intent ||
    typeof intent !== "object" ||
    Array.isArray(intent)
  ) {
    return deny(
      "Intent exists",
      "No valid AIP intent was provided."
    );
  }

  if (
    !transaction ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return deny(
      "Transaction exists",
      "No valid transaction was provided."
    );
  }

  // 2. Category check.
  const categoryPassed =
    typeof intent.category === "string" &&
    intent.category.trim() !== "" &&
    intent.category !== "unknown" &&
    typeof transaction.category === "string" &&
    transaction.category.trim().toLowerCase() ===
      intent.category.trim().toLowerCase();

  addCheck(
    "Category",
    categoryPassed,
    intent.category,
    transaction.category,
    categoryPassed
      ? "Transaction category matches the intent."
      : "Missing, unknown, or mismatched transaction category."
  );

  // 3. Budget and price check.
  const maximum = intent.budget?.maximum;
  const price = transaction.price;

  const parsedMaximum =
    typeof maximum === "number"
      ? maximum
      : typeof maximum === "string" &&
          maximum.trim() !== ""
        ? Number(maximum)
        : NaN;

  const parsedPrice =
    typeof price === "number"
      ? price
      : typeof price === "string" &&
          price.trim() !== ""
        ? Number(price)
        : NaN;

  const budgetValid =
    Number.isFinite(parsedMaximum) &&
    parsedMaximum > 0;

  const priceValid =
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0;

  const budgetPassed =
    budgetValid &&
    priceValid &&
    parsedPrice <= parsedMaximum;

  let budgetReason;

  if (!budgetValid) {
    budgetReason =
      "A valid positive maximum budget is required for purchase authorization.";
  } else if (!priceValid) {
    budgetReason =
      "Transaction price is missing or invalid.";
  } else if (parsedPrice > parsedMaximum) {
    budgetReason =
      "Transaction exceeds the user's authorized budget.";
  } else {
    budgetReason =
      "Transaction is within the authorized budget.";
  }

  addCheck(
    "Budget",
    budgetPassed,
    budgetValid ? parsedMaximum : null,
    priceValid ? parsedPrice : price,
    budgetReason
  );

  // 4. Currency check.
  const normalizeCurrency = (value) =>
    typeof value === "string"
      ? value.trim().toUpperCase()
      : "";

  const intentCurrency =
    normalizeCurrency(intent.currency);

  const budgetCurrency =
    normalizeCurrency(intent.budget?.currency);

  const transactionCurrency =
    normalizeCurrency(transaction.currency);

  const currencyPassed =
    intentCurrency !== "" &&
    budgetCurrency !== "" &&
    transactionCurrency !== "" &&
    intentCurrency === budgetCurrency &&
    intentCurrency === transactionCurrency;

  addCheck(
    "Currency",
    currencyPassed,
    {
      intent: intent.currency ?? null,
      budget: intent.budget?.currency ?? null,
    },
    transaction.currency,
    currencyPassed
      ? "Transaction currency matches the intent and budget."
      : "Missing or mismatched intent, budget, or transaction currency."
  );

  // 5. Agent check.
  // This is a consistency check, not authentication.
  const agentPassed =
    typeof intent.agent === "string" &&
    intent.agent.trim() !== "" &&
    typeof transaction.agent === "string" &&
    transaction.agent === intent.agent;

  addCheck(
    "Agent",
    agentPassed,
    intent.agent,
    transaction.agent,
    agentPassed
      ? "Agent identifiers match."
      : "Missing or mismatched agent identifier."
  );

  // 6. Use-case check.
  let useCasePassed = true;
  let useCaseReason =
    "No specific use case was requested.";

  if (intent.useCase != null) {
    useCasePassed =
      typeof intent.useCase === "string" &&
      intent.useCase.trim() !== "" &&
      Array.isArray(transaction.useCases) &&
      transaction.useCases.some(
        (value) =>
          typeof value === "string" &&
          value.trim().toLowerCase() ===
            intent.useCase.trim().toLowerCase()
      );

    useCaseReason = useCasePassed
      ? "Transaction declares the requested use case."
      : "Requested use case is missing or unsupported.";
  }

  addCheck(
    "Use case",
    useCasePassed,
    intent.useCase ?? null,
    transaction.useCases ?? [],
    useCaseReason
  );

  // 7. Mandatory product requirement checks.
  const requirements = intent.requirements || {};
  const productSpecifications =
    transaction.specifications || {};

  const getActual = (key) =>
    productSpecifications[key] ??
    transaction[key] ??
    null;

  const compareText = (actual, expected) =>
    typeof actual === "string" &&
    typeof expected === "string" &&
    actual.trim().toLowerCase() ===
      expected.trim().toLowerCase();

  const requirementChecks = [];

  const checkRequirement = (
    name,
    expected,
    actual,
    matches
  ) => {
    const passed =
      actual === null || actual === undefined
        ? false
        : matches(actual, expected);

    requirementChecks.push({
      name,
      passed,
      expected,
      actual,
      reason: passed
        ? `${name} matches the requested requirement.`
        : actual == null
          ? `${name} cannot be verified from transaction data.`
          : `${name} does not match the requested requirement.`,
    });
  };

  if (requirements.processorBrand) {
    checkRequirement(
      "Processor brand",
      requirements.processorBrand,
      getActual("processorBrand"),
      compareText
    );
  }

  if (requirements.processorFamily) {
    checkRequirement(
      "Processor family",
      requirements.processorFamily,
      getActual("processorFamily"),
      compareText
    );
  }

  if (requirements.processorGeneration != null) {
    checkRequirement(
      "Processor generation",
      requirements.processorGeneration,
      getActual("processorGeneration"),
      (actual, expected) =>
        Number.isInteger(Number(actual)) &&
        Number(actual) === Number(expected)
    );
  }

  if (requirements.ramGb != null) {
    checkRequirement(
      "RAM",
      requirements.ramGb,
      getActual("ramGb"),
      (actual, expected) =>
        Number.isFinite(Number(actual)) &&
        Number(actual) >= Number(expected)
    );
  }

  if (requirements.storage) {
    const actualStorage =
      productSpecifications.storage ??
      transaction.storage ??
      null;

    const expectedStorage = requirements.storage;

    let storagePassed = false;

    if (
      actualStorage &&
      typeof actualStorage === "object"
    ) {
      const capacityPassed =
        Number.isFinite(Number(actualStorage.capacityGb)) &&
        Number(actualStorage.capacityGb) >=
          Number(expectedStorage.capacityGb);

      const expectedType = expectedStorage.type;
      const actualType = actualStorage.type;

      const typePassed =
        !expectedType ||
        compareText(actualType, expectedType);

      storagePassed = capacityPassed && typePassed;
    }

    const storageCheck = {
      name: "Storage",
      passed: storagePassed,
      expected: expectedStorage,
      actual: actualStorage,
      reason: storagePassed
        ? "Storage capacity and type meet the requirement."
        : actualStorage == null
          ? "Storage specifications cannot be verified."
          : "Storage capacity or type does not match.",
    };

    requirementChecks.push(storageCheck);
  }

  if (requirements.graphicsCard) {
    checkRequirement(
      "Graphics card",
      requirements.graphicsCard,
      getActual("graphicsCard"),
      (actual, expected) =>
        typeof actual === "string" &&
        actual.toLowerCase().includes(
          expected.toLowerCase()
        )
    );
  }

  for (const check of requirementChecks) {
    addCheck(
      check.name,
      check.passed,
      check.expected,
      check.actual,
      check.reason
    );
  }

  // 8. Final authorization.
  // Every mandatory check must pass.
  const authorized =
    checks.length > 0 &&
    checks.every((check) => check.passed);

  const reasons = checks
    .filter((check) => !check.passed)
    .map((check) => check.reason);

  return {
    authorized,
    status: authorized ? "AUTHORIZED" : "DENIED",
    checks,
    reasons,
  };
}
