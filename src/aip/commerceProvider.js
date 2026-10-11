
function parsePrice(priceText) {
  if (typeof priceText !== "string") return null;

  // Examples: ₹74,999 | ₹74,999.50 | Rs. 12,990
  const match = priceText.match(/[\d,]+(?:\.\d{1,2})?/);

  if (!match) return null;

  const price = Number(match[0].replace(/,/g, ""));

  return Number.isFinite(price) && price > 0
    ? price
    : null;
}

// -------------------------
// BUILD SEARCH QUERY
// -------------------------

function buildSearchQuery(intent) {
  const requirements = intent.requirements || {};

  const parts = [
    requirements.processorBrand,
    requirements.processorFamily,
    requirements.processorGeneration
      ? `${requirements.processorGeneration}th generation`
      : null,
    requirements.storage?.capacityGb
      ? `${requirements.storage.capacityGb}GB`
      : null,
    requirements.storage?.type,
    requirements.ramGb
      ? `${requirements.ramGb}GB RAM`
      : null,
    requirements.graphicsCard,
    intent.useCase,
    intent.category !== "unknown" ? intent.category : null,
  ];

  return parts
    .filter(
      (value) =>
        typeof value === "string" && value.trim()
    )
    .join(" ")
    .trim();
}

// -------------------------
// CURRENCY NORMALIZATION
// -------------------------

function normalizeCurrency(value) {
  if (typeof value !== "string") return "";

  const normalized = value.trim().toUpperCase();

  const aliases = {
    "₹": "INR",
    RS: "INR",
    "RS.": "INR",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
  };

  return aliases[normalized] || normalized;
}

// -------------------------
// COMMERCE PROVIDER
// -------------------------

export const commerceProvider = {
  async search(intent) {
    if (!intent || typeof intent !== "object") {
      throw new Error("A valid AIP intent is required.");
    }

    const query = buildSearchQuery(intent);

    if (!query) {
      throw new Error(
        "The intent must include a product category or product requirements."
      );
    }

    // Use the Vite proxy to reach the backend on port 3001.
    const params = new URLSearchParams({ q: query });

    const response = await fetch(
      `/api/commerce/search?${params.toString()}`,
      {
        signal: AbortSignal.timeout(25000),
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Commerce API returned an invalid response."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Live commerce search failed."
      );
    }

    if (!Array.isArray(data.products)) {
      throw new Error(
        "Commerce API returned an invalid product list."
      );
    }

    const maximum = intent.budget?.maximum;
    const expectedCurrency = normalizeCurrency(
      intent.currency || intent.budget?.currency || "INR"
    );

    if (
      maximum !== null &&
      maximum !== undefined &&
      (
        !Number.isFinite(Number(maximum)) ||
        Number(maximum) <= 0
      )
    ) {
      throw new Error(
        "The intent contains an invalid maximum budget."
      );
    }

    if (!expectedCurrency) {
      throw new Error(
        "The intent must specify a valid currency."
      );
    }

    // Convert provider results into AIP product candidates.
    const products = data.products.map((item) => {
      const priceText = item.priceText || item.price || null;

      const price =
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price > 0
          ? item.price
          : parsePrice(priceText);

      return {
        id: item.id ?? item.product_id ?? null,
        name: item.name || "Unnamed product",

        // Provider results must not be treated as verified
        // category/specification matches automatically.
        category: item.category || null,

        price,
        priceText,
        currency: normalizeCurrency(
          item.currency || expectedCurrency
        ),

        store:
          item.merchant ||
          item.source ||
          "Shopping provider",

        source: item.source || "Google Shopping",
        image: item.image || null,
        url: item.url || null,
        rating: item.rating ?? null,

        live: data.live === true,

        // Preserve actual provider metadata if available.
        specifications: item.specifications || null,
        useCases: Array.isArray(item.useCases)
          ? item.useCases
          : [],
      };
    });

    // Apply only checks supported by the returned data.
    return products
      .filter((item) => {
        if (item.price === null) return false;

        if (item.currency !== expectedCurrency) {
          return false;
        }

        if (
          maximum !== null &&
          maximum !== undefined &&
          item.price > Number(maximum)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.price - b.price);
  },
};

// -------------------------
// SEARCH INTERFACE
// -------------------------

export async function searchCommerce(
  intent,
  provider = commerceProvider
) {
  if (!intent || typeof intent !== "object") {
    throw new Error(
      "A valid AIP intent is required for commerce search."
    );
  }

  if (!provider || typeof provider.search !== "function") {
    throw new Error(
      "Commerce provider must implement search(intent)."
    );
  }

  const products = await provider.search(intent);

  if (!Array.isArray(products)) {
    throw new Error(
      "Commerce provider must return an array of products."
    );
  }

  return products;
}
