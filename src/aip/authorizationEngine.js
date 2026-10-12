/**
 * AIP authorization policy: ALLOW / REVIEW / DENY
 *
 * ALLOW  -> all required checks pass.
 * REVIEW -> required evidence is missing or uncertain.
 * DENY   -> a confirmed policy violation exists.
 *
 * Production note: enforce authorization on a trusted server
 * before any payment or purchase action.
 */

const DECISIONS = Object.freeze({
  ALLOW: "ALLOW",
  REVIEW: "REVIEW",
  DENY: "DENY",
});

function makeCheck(name, status, reason, expected = null, actual = null) {
  return {
    name,
    status,
    passed: status === DECISIONS.ALLOW,
    reason,
    expected,
    actual,
  };
}

function normalizeNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizedString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function resultFromChecks(checks) {
  const hasDeny = checks.some(
    (check) => check.status === DECISIONS.DENY
  );
  const hasReview = checks.some(
    (check) => check.status === DECISIONS.REVIEW
  );

  const status = hasDeny
    ? DECISIONS.DENY
    : hasReview
      ? DECISIONS.REVIEW
      : DECISIONS.ALLOW;

  return {
    status,
    decision: status,
    // Only ALLOW is considered authorized.
    authorized: status === DECISIONS.ALLOW,
    checks,
    reasons: checks
      .filter((check) => check.status !== DECISIONS.ALLOW)
      .map((check) => check.reason),
  };
}

export function authorizeTransaction(intent, transaction) {
  const checks = [];

  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return resultFromChecks([
      makeCheck(
        "Intent",
        DECISIONS.DENY,
        "A valid structured intent is required."
      ),
    ]);
  }

  if (
    !transaction ||
    typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    return resultFromChecks([
      makeCheck(
        "Transaction",
        DECISIONS.DENY,
        "A valid transaction object is required."
      ),
    ]);
  }

  // 1. Budget
  const budgetValue = intent.budget?.maximum;
  const budget =
    budgetValue === null || budgetValue === undefined
      ? null
      : normalizeNumber(budgetValue);

  if (budgetValue === null || budgetValue === undefined) {
    checks.push(
      makeCheck(
        "Budget",
        DECISIONS.REVIEW,
        "The intent does not specify a maximum budget.",
        "Explicit maximum budget",
        null
      )
    );
  } else if (budget === null || budget < 0) {
    checks.push(
      makeCheck(
        "Budget",
        DECISIONS.DENY,
        "The intent contains an invalid or negative budget.",
        "Finite non-negative amount",
        budgetValue
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Budget",
        DECISIONS.ALLOW,
        "A valid maximum budget is specified.",
        budget,
        budget
      )
    );
  }

  // 2. Price and budget compliance
  const price = normalizeNumber(transaction.price);
  const priceMissing =
    transaction.price === null ||
    transaction.price === undefined ||
    transaction.price === "";

  if (priceMissing) {
    checks.push(
      makeCheck(
        "Price",
        DECISIONS.REVIEW,
        "The product price is missing and must be verified.",
        budget,
        null
      )
    );
  } else if (price === null || price <= 0) {
    checks.push(
      makeCheck(
        "Price",
        DECISIONS.DENY,
        "The product price is invalid.",
        "Finite amount greater than zero",
        transaction.price
      )
    );
  } else if (budget !== null && budget >= 0 && price > budget) {
    checks.push(
      makeCheck(
        "Budget compliance",
        DECISIONS.DENY,
        "The product price exceeds the user's maximum budget.",
        budget,
        price
      )
    );
  } else if (budget === null || budget < 0) {
    checks.push(
      makeCheck(
        "Budget compliance",
        DECISIONS.REVIEW,
        "Budget compliance cannot be confirmed without a valid maximum budget.",
        budget,
        price
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Budget compliance",
        DECISIONS.ALLOW,
        "The product price is within the user's maximum budget.",
        budget,
        price
      )
    );
  }

  // 3. Currency consistency
  const intentCurrency = normalizedString(intent.currency);
  const budgetCurrency = normalizedString(intent.budget?.currency);
  const transactionCurrency = normalizedString(transaction.currency);

  if (!intentCurrency || !budgetCurrency || !transactionCurrency) {
    checks.push(
      makeCheck(
        "Currency",
        DECISIONS.REVIEW,
        "Currency information is incomplete; it must be verified.",
        intent.currency || intent.budget?.currency || "Explicit currency",
        transaction.currency ?? null
      )
    );
  } else if (
    intentCurrency !== budgetCurrency ||
    intentCurrency !== transactionCurrency
  ) {
    checks.push(
      makeCheck(
        "Currency",
        DECISIONS.DENY,
        "The intent, budget, and transaction currencies do not match.",
        intent.currency,
        transaction.currency
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Currency",
        DECISIONS.ALLOW,
        "Intent, budget, and transaction currencies match.",
        intent.currency,
        transaction.currency
      )
    );
  }

  // 4. Category consistency
  const intentCategory = normalizedString(intent.category);
  const transactionCategory = normalizedString(transaction.category);

  if (!intentCategory || !transactionCategory) {
    checks.push(
      makeCheck(
        "Category",
        DECISIONS.REVIEW,
        "The intent or transaction category is missing.",
        intent.category ?? null,
        transaction.category ?? null
      )
    );
  } else if (intentCategory !== transactionCategory) {
    checks.push(
      makeCheck(
        "Category",
        DECISIONS.DENY,
        "The transaction category differs from the user's requested category.",
        intent.category,
        transaction.category
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Category",
        DECISIONS.ALLOW,
        "The transaction category matches the user's intent.",
        intent.category,
        transaction.category
      )
    );
  }

  // 5. Agent consistency.
  // This compares fields; it does NOT authenticate the agent.
  const intentAgent = normalizedString(intent.agent);
  const transactionAgent = normalizedString(transaction.agent);

  if (!intentAgent || !transactionAgent) {
    checks.push(
      makeCheck(
        "Agent",
        DECISIONS.REVIEW,
        "Agent identity information is missing.",
        intent.agent ?? null,
        transaction.agent ?? null
      )
    );
  } else if (intentAgent !== transactionAgent) {
    checks.push(
      makeCheck(
        "Agent",
        DECISIONS.DENY,
        "The transaction agent differs from the agent named in the intent.",
        intent.agent,
        transaction.agent
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Agent",
        DECISIONS.ALLOW,
        "The transaction agent matches the intent's agent field.",
        intent.agent,
        transaction.agent
      )
    );
  }

  // 6. Use-case evidence
  const requestedUseCase = normalizedString(intent.useCase);
  const transactionUseCases = Array.isArray(transaction.useCases)
    ? transaction.useCases.map(normalizedString).filter(Boolean)
    : [];

  if (requestedUseCase && transactionUseCases.length === 0) {
    checks.push(
      makeCheck(
        "Use-case match",
        DECISIONS.REVIEW,
        "Product suitability has not been verified against the requested use case.",
        intent.useCase,
        null
      )
    );
  } else if (
    requestedUseCase &&
    !transactionUseCases.includes(requestedUseCase)
  ) {
    checks.push(
      makeCheck(
        "Use-case match",
        DECISIONS.REVIEW,
        "Available product data does not establish that the product meets the requested use case.",
        intent.useCase,
        transaction.useCases
      )
    );
  } else {
    checks.push(
      makeCheck(
        "Use-case match",
        DECISIONS.ALLOW,
        requestedUseCase
          ? "The supplied product use-case evidence matches the intent."
          : "No specific use case was requested.",
        intent.useCase ?? null,
        transaction.useCases ?? []
      )
    );
  }

  // 7. Product requirements.
  // Never infer verification from the user's requested values or product title.
  const requestedRequirements =
    intent.requirements &&
    typeof intent.requirements === "object" &&
    !Array.isArray(intent.requirements)
      ? intent.requirements
      : {};

  const requirementEntries = Object.entries(requestedRequirements).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );

  if (requirementEntries.length > 0) {
    const specs =
      transaction.specifications &&
      typeof transaction.specifications === "object" &&
      !Array.isArray(transaction.specifications)
        ? transaction.specifications
        : {};

    const verified = transaction.specificationsVerified === true;
    const missingKeys = requirementEntries
      .filter(
        ([key]) =>
          specs[key] === null ||
          specs[key] === undefined ||
          specs[key] === ""
      )
      .map(([key]) => key);

    if (!verified || missingKeys.length > 0) {
      checks.push(
        makeCheck(
          "Product requirements",
          DECISIONS.REVIEW,
          !verified
            ? "Required product specifications have not been independently verified."
            : `Product data is missing required fields: ${missingKeys.join(", ")}.`,
          requestedRequirements,
          specs
        )
      );
    } else {
      const mismatches = requirementEntries.filter(([key, expected]) => {
        return normalizedString(specs[key]) !== normalizedString(expected);
      });

      if (mismatches.length > 0) {
        checks.push(
          makeCheck(
            "Product requirements",
            DECISIONS.DENY,
            `Verified product specifications conflict with the intent: ${mismatches
              .map(([key]) => key)
              .join(", ")}.`,
            requestedRequirements,
            specs
          )
        );
      } else {
        checks.push(
          makeCheck(
            "Product requirements",
            DECISIONS.ALLOW,
            "All requested product requirements match verified specifications.",
            requestedRequirements,
            specs
          )
        );
      }
    }
  } else {
    checks.push(
      makeCheck(
        "Product requirements",
        DECISIONS.ALLOW,
        "No additional structured product requirements were provided.",
        {},
        transaction.specifications ?? {}
      )
    );
  }

  return resultFromChecks(checks);
}

export { DECISIONS };