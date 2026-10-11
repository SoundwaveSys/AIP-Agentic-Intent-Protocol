
const CURRENCY_DEFAULT = "INR";

export function parseIntent(command) {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("Please enter a valid instruction.");
  }

  const rawCommand = command.trim();
  const text = rawCommand.toLowerCase();

  const category = detectCategory(text);

  return {
    version: "AIP-0.1",
    purpose: detectPurpose(text),
    category,
    useCase: detectUseCase(text),
    budget: detectBudget(text),
    currency: detectCurrency(text),
    requirements: detectRequirements(text, category),
    requestedBy: "human",
    agent: "jinni",
    rawCommand,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------
// PURPOSE
// -------------------------

function detectPurpose(text) {
  if (/\b(plan|planning|organize|organise|itinerary)\b/i.test(text)) {
    return "planning";
  }

  if (
    /\b(find|search|buy|purchase|get|order|shop|recommend|compare)\b/i.test(text) ||
    /\blooking for\b|\bshow me\b|\bi want\b/i.test(text)
  ) {
    return "purchase";
  }

  return "unknown";
}

// -------------------------
// CATEGORY
// -------------------------

function detectCategory(text) {
  // Check specific categories before broad terms.
  if (
    /\b(cpu|processor|desktop cpu)\b/i.test(text)
  ) {
    return "desktop_cpu";
  }

  if (
    /\b(headphones?|earbuds?|earphones?|airpods|speakers?|headsets?)\b/i.test(text)
  ) {
    return "audio";
  }

  if (
    /\b(laptops?|macbooks?|notebooks?)\b/i.test(text)
  ) {
    return "laptop";
  }

  if (
    /\b(desktop computer|desktop pc|personal computer|computer)\b/i.test(text)
  ) {
    return "computer";
  }

  if (
    /\b(shoes?|sneakers?|trainers)\b/i.test(text)
  ) {
    return "shoes";
  }

  if (
    /\b(iphone|smartphones?|mobiles?|cell phones?)\b/i.test(text)
  ) {
    return "phone";
  }

  if (
    /\b(smartwatches?|watches)\b/i.test(text)
  ) {
    return "watch";
  }

  if (
    /\b(trips?|travel|hotels?|flights?)\b/i.test(text)
  ) {
    return "travel";
  }

  if (
    /\b(gifts?|birthday presents?)\b/i.test(text)
  ) {
    return "gift";
  }

  return "unknown";
}

// -------------------------
// USE CASE
// -------------------------

function detectUseCase(text) {
  if (
    /\b(coding|programming|developer|development)\b/i.test(text)
  ) {
    return "coding";
  }

  if (/\b(gaming|games|gamer)\b/i.test(text)) {
    return "gaming";
  }

  if (/\b(office|work|productivity)\b/i.test(text)) {
    return "work";
  }

  if (/\b(running|runner)\b/i.test(text)) {
    return "running";
  }

  if (/\b(travel|trip)\b/i.test(text)) {
    return "travel";
  }

  return null;
}

// -------------------------
// CURRENCY
// -------------------------

function detectCurrency(text) {
  if (/\b(usd|dollars?)\b|\$/i.test(text)) {
    return "USD";
  }

  if (/\b(eur|euros?)\b|€/i.test(text)) {
    return "EUR";
  }

  if (/\b(gbp|pounds?)\b|£/i.test(text)) {
    return "GBP";
  }

  return CURRENCY_DEFAULT;
}

// -------------------------
// BUDGET
// -------------------------

function detectBudget(text) {
  const number = String.raw`(\d[\d,]*(?:\.\d+)?)`;
  const amount = String.raw`(?:₹|rs\.?\s*|inr\s*)?${number}`;

  const patterns = [
    new RegExp(
      String.raw`\b(?:under|below|less than|within|up to|upto|maximum|max|budget(?: of)?|total budget(?: is)?|budget is)\s*${amount}\s*(lakh|lakhs|lac|lacs|k|thousand)?\b`,
      "i"
    ),
    new RegExp(
      String.raw`(?:₹|rs\.?\s*|inr\s*)${number}\s*(lakh|lakhs|lac|lacs|k|thousand)?\b`,
      "i"
    ),
    new RegExp(
      String.raw`${number}\s*(lakh|lakhs|lac|lacs|k|thousand)\b`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const numericText = match[1];
    const unit = (match[2] || "").toLowerCase();

    let maximum = Number(numericText.replace(/,/g, ""));

    if (["lakh", "lakhs", "lac", "lacs"].includes(unit)) {
      maximum *= 100000;
    } else if (["k", "thousand"].includes(unit)) {
      maximum *= 1000;
    }

    if (Number.isFinite(maximum) && maximum > 0) {
      return {
        maximum: Math.round(maximum),
        currency: detectCurrency(text),
      };
    }
  }

  return {
    maximum: null,
    currency: detectCurrency(text),
  };
}

// -------------------------
// PRODUCT REQUIREMENTS
// -------------------------

function detectRequirements(text, category) {
  const requirements = {};

  // CPU brand and model family
  if (/\bintel\b/i.test(text)) {
    requirements.processorBrand = "Intel";
  } else if (/\bamd\b/i.test(text)) {
    requirements.processorBrand = "AMD";
  }

  // Intel Core i3/i5/i7/i9 and generation
  const intelMatch = text.match(
    /\b(?:intel\s*)?(?:core\s*)?i([3579])(?:\s*[- ]?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:gen(?:eration)?|gen))?\b/i
  );

  if (intelMatch) {
    requirements.processorFamily = `Core i${intelMatch[1]}`;

    if (intelMatch[2]) {
      requirements.processorGeneration = Number(intelMatch[2]);
    }
  }

  // AMD Ryzen family and optional generation
  const ryzenMatch = text.match(
    /\bryzen\s*([3579])(?:\s*[- ]?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:gen(?:eration)?|gen))?\b/i
  );

  if (ryzenMatch) {
    requirements.processorBrand = "AMD";
    requirements.processorFamily = `Ryzen ${ryzenMatch[1]}`;

    if (ryzenMatch[2]) {
      requirements.processorGeneration = Number(ryzenMatch[2]);
    }
  }

  // Storage capacity: 512GB SSD, 1TB HDD, etc.
  const storageMatch = text.match(
    /\b(256|512|1024|2048|128|1|2|4)\s*(gb|tb)\s*(ssd|hdd|hard\s*disk|storage)?\b|\b(ssd|hdd|hard\s*disk)\s*(?:of\s*)?(256|512|1024|2048|128|1|2|4)\s*(gb|tb)\b/i
  );

  if (storageMatch) {
    let capacity;
    let unit;
    let storageType;

    if (storageMatch[1]) {
      capacity = Number(storageMatch[1]);
      unit = storageMatch[2].toLowerCase();
      storageType = storageMatch[3];
    } else {
      storageType = storageMatch[4];
      capacity = Number(storageMatch[5]);
      unit = storageMatch[6].toLowerCase();
    }

    const capacityGb =
      capacity * (unit === "tb" ? 1024 : 1);

    requirements.storage = {
      capacityGb,
      type: storageType
        ? /hdd|hard\s*disk/i.test(storageType)
          ? "HDD"
          : /ssd/i.test(storageType)
            ? "SSD"
            : null
        : null,
    };
  }

  // RAM: 8GB RAM, 16 GB memory
  const ramMatch = text.match(
    /\b(4|8|12|16|24|32|48|64)\s*gb\s*(?:of\s*)?(?:ram|memory)\b|\b(?:ram|memory)\s*(?:of\s*)?(4|8|12|16|24|32|48|64)\s*gb\b/i
  );

  if (ramMatch) {
    requirements.ramGb = Number(ramMatch[1] || ramMatch[2]);
  }

  // Graphics card
  const gpuMatch = text.match(
    /\b(rtx\s*\d{3,4}(?:\s*ti|super)?|gtx\s*\d{3,4}(?:\s*ti)?|radeon\s*rx\s*\d{3,4})\b/i
  );

  if (gpuMatch) {
    requirements.graphicsCard = gpuMatch[1].replace(/\s+/g, " ").trim();
  }

  // Product-specific category is retained for future rules.
  requirements.productType = category;

  return requirements;
}
