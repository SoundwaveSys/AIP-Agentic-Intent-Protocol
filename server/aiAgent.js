
import crypto from "node:crypto";

const CATEGORIES = new Set([
    "laptop",
    "shoes",
    "phone",
    "audio",
    "watch",
    "travel",
    "gift",
    "computer",
    "desktop_cpu",
    "unknown"
]);

const PURPOSES = new Set(["purchase", "planning", "unknown"]);

const USE_CASES = new Set([
    "coding",
    "gaming",
    "work",
    "running",
    "travel",
    "study",
    null
]);

const PLAN_ACTIONS = new Set([
    "search_products",
    "compare_products",
    "ask_user"
]);

const CURRENCIES = new Set(["INR", "USD", "EUR", "GBP"]);
const MAX_COMMAND_LENGTH = 2000;

// OpenAI-style schema definition used as the source of truth.
// It is converted to Gemini's supported schema format below.
const intentSchema = {
    type: "object",
    additionalProperties: false,
    required: ["intent", "plan"],
    properties: {
        intent: {
            type: "object",
            additionalProperties: false,
            required: [
                "purpose",
                "category",
                "useCase",
                "budget",
                "currency",
                "requirements",
                "clarificationNeeded",
                "clarificationQuestion"
            ],
            properties: {
                purpose: {
                    type: "string",
                    enum: ["purchase", "planning", "unknown"]
                },
                category: {
                    type: "string",
                    enum: [...CATEGORIES]
                },
                useCase: {
                    type: ["string", "null"],
                    enum: ["coding", "gaming", "work", "running", "travel", "study", null]
                },
                budget: {
                    type: "object",
                    additionalProperties: false,
                    required: ["maximum", "currency"],
                    properties: {
                        maximum: {
                            type: ["number", "null"]
                        },
                        currency: {
                            type: "string",
                            enum: [...CURRENCIES]
                        }
                    }
                },
                currency: {
                    type: "string",
                    enum: [...CURRENCIES]
                },
                requirements: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                        "processorBrand",
                        "processorFamily",
                        "processorGeneration",
                        "storage",
                        "ramGb",
                        "graphicsCard",
                        "productType",
                        "batteryLifeHours",
                        "displaySizeInches"
                    ],
                    properties: {
                        processorBrand: {
                            type: ["string", "null"]
                        },
                        processorFamily: {
                            type: ["string", "null"]
                        },
                        processorGeneration: {
                            type: ["integer", "null"]
                        },
                        storage: {
                            type: ["object", "null"],
                            additionalProperties: false,
                            required: ["capacityGb", "type"],
                            properties: {
                                capacityGb: {
                                    type: ["number", "null"]
                                },
                                type: {
                                    type: ["string", "null"],
                                    enum: ["SSD", "HDD", null]
                                }
                            }
                        },
                        ramGb: {
                            type: ["number", "null"]
                        },
                        graphicsCard: {
                            type: ["string", "null"]
                        },
                        productType: {
                            type: ["string", "null"]
                        },
                        batteryLifeHours: {
                            type: ["number", "null"]
                        },
                        displaySizeInches: {
                            type: ["number", "null"]
                        }
                    }
                },
                clarificationNeeded: {
                    type: "boolean"
                },
                clarificationQuestion: {
                    type: ["string", "null"]
                }
            }
        },
        plan: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["action", "reason"],
                properties: {
                    action: {
                        type: "string",
                        enum: [...PLAN_ACTIONS]
                    },
                    reason: {
                        type: "string"
                    }
                }
            }
        }
    }
};

// Convert JSON Schema types to Gemini Schema types.
// Gemini uses uppercase type names and nullable: true rather
// than JSON Schema's ["string", "null"] type representation.

// function toGeminiSchema(schema) {
//     if (Array.isArray(schema)) {
//         return schema.map(toGeminiSchema);
//     }

//     if (!schema || typeof schema !== "object") {
//         return schema;
//     }

//     const result = {};

//     for (const [key, value] of Object.entries(schema)) {
//         // Gemini does not support this JSON Schema property.
//         if (key === "additionalProperties") continue;

//         if (key === "type") {
//             if (Array.isArray(value)) {
//                 const nonNullTypes = value.filter((type) => type !== "null");

//                 result.type = (nonNullTypes[0] || "string").toUpperCase();
//                 result.nullable = value.includes("null");
//             } else if (typeof value === "string") {
//                 result.type = value.toUpperCase();
//             }

//             continue;
//         }

//         if (key === "enum") {
//             // Gemini enums must not contain null.
//             result.enum = value.filter((item) => item !== null);
//             continue;
//         }

//         result[key] = toGeminiSchema(value);
//     }

//     return result;
// }



const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    intent: {
      type: "OBJECT",
      properties: {
        purpose: {
          type: "STRING",
          enum: ["purchase", "planning", "unknown"]
        },
        category: {
          type: "STRING",
          enum: [
            "laptop", "shoes", "phone", "audio", "watch",
            "travel", "gift", "computer", "desktop_cpu", "unknown"
          ]
        },
        useCase: {
          type: "STRING",
          nullable: true,
          enum: ["coding", "gaming", "work", "running", "travel", "study"]
        },
        budget: {
          type: "OBJECT",
          properties: {
            maximum: {
              type: "NUMBER",
              nullable: true
            },
            currency: {
              type: "STRING",
              enum: ["INR", "USD", "EUR", "GBP"]
            }
          },
          required: ["maximum", "currency"]
        },
        currency: {
          type: "STRING",
          enum: ["INR", "USD", "EUR", "GBP"]
        },
        requirements: {
          type: "OBJECT",
          properties: {
            processorBrand: { type: "STRING", nullable: true },
            processorFamily: { type: "STRING", nullable: true },
            processorGeneration: { type: "INTEGER", nullable: true },
            storage: {
              type: "OBJECT",
              properties: {
                capacityGb: { type: "NUMBER", nullable: true },
                type: {
                  type: "STRING",
                  nullable: true,
                  enum: ["SSD", "HDD"]
                }
              },
              required: ["capacityGb", "type"]
            },
            ramGb: { type: "NUMBER", nullable: true },
            graphicsCard: { type: "STRING", nullable: true },
            productType: { type: "STRING", nullable: true },
            batteryLifeHours: { type: "NUMBER", nullable: true },
            displaySizeInches: { type: "NUMBER", nullable: true }
          },
          required: [
            "processorBrand",
            "processorFamily",
            "processorGeneration",
            "storage",
            "ramGb",
            "graphicsCard",
            "productType",
            "batteryLifeHours",
            "displaySizeInches"
          ]
        },
        clarificationNeeded: { type: "BOOLEAN" },
        clarificationQuestion: { type: "STRING", nullable: true }
      },
      required: [
        "purpose",
        "category",
        "useCase",
        "budget",
        "currency",
        "requirements",
        "clarificationNeeded",
        "clarificationQuestion"
      ]
    },
    plan: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          action: {
            type: "STRING",
            enum: ["search_products", "compare_products", "ask_user"]
          },
          reason: { type: "STRING" }
        },
        required: ["action", "reason"]
      }
    }
  },
  required: ["intent", "plan"]
};


function validateRequirements(requirements) {
    if (
        !requirements ||
        typeof requirements !== "object" ||
        Array.isArray(requirements)
    ) {
        throw new Error("AI response contains invalid requirements.");
    }

    const nullableStrings = [
        "processorBrand",
        "processorFamily",
        "graphicsCard",
        "productType"
    ];

    for (const key of nullableStrings) {
        const value = requirements[key];

        if (value !== null && typeof value !== "string") {
            throw new Error(`AI response contains an invalid ${key}.`);
        }
    }

    const nullableNumbers = [
        "processorGeneration",
        "ramGb",
        "batteryLifeHours",
        "displaySizeInches"
    ];

    for (const key of nullableNumbers) {
        const value = requirements[key];

        if (
            value !== null &&
            (typeof value !== "number" ||
                !Number.isFinite(value) ||
                value <= 0)
        ) {
            throw new Error(`AI response contains an invalid ${key}.`);
        }
    }

    const storage = requirements.storage;

    if (storage !== null) {
        if (
            !storage ||
            typeof storage !== "object" ||
            Array.isArray(storage)
        ) {
            throw new Error("AI response contains invalid storage requirements.");
        }

        if (
            storage.capacityGb !== null &&
            (typeof storage.capacityGb !== "number" ||
                !Number.isFinite(storage.capacityGb) ||
                storage.capacityGb <= 0)
        ) {
            throw new Error("AI response contains an invalid storage capacity.");
        }

        if (
            storage.type !== null &&
            !["SSD", "HDD"].includes(storage.type)
        ) {
            throw new Error("AI response contains an invalid storage type.");
        }
    }
}

function validateAIResult(value, rawCommand) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("AI returned an invalid intent object.");
    }

    const candidate = value.intent;

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error("AI response is missing the structured intent.");
    }

    if (
        !PURPOSES.has(candidate.purpose) ||
        !CATEGORIES.has(candidate.category) ||
        !USE_CASES.has(candidate.useCase)
    ) {
        throw new Error("AI response contains an unsupported purpose, category, or use case.");
    }

    if (
        !candidate.budget ||
        typeof candidate.budget !== "object" ||
        Array.isArray(candidate.budget) ||
        !CURRENCIES.has(candidate.currency) ||
        !CURRENCIES.has(candidate.budget.currency)
    ) {
        throw new Error("AI response contains invalid currency or budget fields.");
    }

    const maximum = candidate.budget.maximum;

    if (
        maximum !== null &&
        (typeof maximum !== "number" ||
            !Number.isFinite(maximum) ||
            maximum <= 0)
    ) {
        throw new Error("AI response contains an invalid budget.");
    }

    if (typeof candidate.clarificationNeeded !== "boolean") {
        throw new Error("AI response is missing clarification status.");
    }

    if (
        candidate.clarificationQuestion !== null &&
        typeof candidate.clarificationQuestion !== "string"
    ) {
        throw new Error("AI response contains an invalid clarification question.");
    }

    if (
        candidate.budget.currency !== candidate.currency &&
        maximum !== null
    ) {
        throw new Error("Budget currency and intent currency must match.");
    }

    validateRequirements(candidate.requirements);

    if (
        !Array.isArray(value.plan) ||
        value.plan.length < 1 ||
        value.plan.length > 5
    ) {
        throw new Error("AI response contains an invalid execution plan.");
    }

    const plan = value.plan.map((step) => {
        if (
            !step ||
            typeof step !== "object" ||
            !PLAN_ACTIONS.has(step.action) ||
            typeof step.reason !== "string"
        ) {
            throw new Error("AI response contains an unsupported plan action.");
        }

        return {
            action: step.action,
            reason: step.reason.slice(0, 300)
        };
    });

    const intent = {
        version: "AIP-0.1",
        purpose: candidate.purpose,
        category: candidate.category,
        useCase: candidate.useCase,
        budget: {
            maximum,
            currency: candidate.budget.currency
        },
        currency: candidate.currency,
        requirements: candidate.requirements,
        requestedBy: "human",
        agent: "jinni",
        rawCommand,
        createdAt: new Date().toISOString(),
        clarificationNeeded: candidate.clarificationNeeded,
        clarificationQuestion: candidate.clarificationQuestion
    };

    // Ambiguous requests must not trigger product searches.
    if (
        intent.purpose === "unknown" ||
        intent.category === "unknown" ||
        intent.clarificationNeeded
    ) {
        intent.clarificationNeeded = true;

        if (!intent.clarificationQuestion) {
            intent.clarificationQuestion =
                "Could you clarify what you want and any important constraints?";
        }

        return {
            intent,
            plan: [
                {
                    action: "ask_user",
                    reason: "The request is ambiguous or missing essential information."
                }
            ],
            runId: crypto.randomUUID()
        };
    }

    // Ensure purchase requests include a search step.
    const planHasSearch = plan.some(
        (step) => step.action === "search_products"
    );

    if (
        intent.purpose === "purchase" &&
        !planHasSearch
    ) {
        plan.unshift({
            action: "search_products",
            reason: "Search for candidates matching the validated intent."
        });

        if (plan.length > 5) {
            plan.length = 5;
        }
    }

    return {
        intent,
        plan,
        runId: crypto.randomUUID()
    };
}

export async function createAgentPlan(rawCommand) {
    if (typeof rawCommand !== "string" || !rawCommand.trim()) {
        throw new Error("Please enter an instruction for Jinni.");
    }

    const command = rawCommand.trim();

    if (command.length > MAX_COMMAND_LENGTH) {
        throw new Error(
            `Instruction must be ${MAX_COMMAND_LENGTH} characters or fewer.`
        );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error(
            "Gemini is not configured. Set GEMINI_API_KEY in the server .env file."
        );
    }

    const model = (
        process.env.GEMINI_MODEL || "gemini-2.5-flash"
    ).trim();

    const prompt = [
        "You are Jinni's intent interpreter and planning component for AIP-0.1.",
        "Interpret the user's request semantically; do not rely only on keywords.",
        "Return JSON matching the supplied response schema.",
        "Never invent product facts or claim product specifications are verified.",
        "Extract only constraints explicitly stated or unambiguously implied.",
        "If essential details are unclear, set clarificationNeeded=true and ask one concise question.",
        "Budget maximum must be a positive numeric amount or null.",
        "Normalize lakh/lac to 100000 and k/thousand to 1000.",
        "Keep budget currency and intent currency consistent.",
        "Use null for unknown optional requirement values.",
        "Allowed plan actions: search_products, compare_products, ask_user.",
        "Never plan a purchase, payment, checkout, or money transfer.",
        "The plan is advisory. The server must independently validate outputs and enforce authorization.",
        "",
        "User instruction:",
        command
    ].join("\n");

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent`;

    let response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
            },
            signal: AbortSignal.timeout(35000),
            body: JSON.stringify({
                systemInstruction: {
                    parts: [
                        {
                            text: "Interpret intent carefully. Return only JSON conforming to the response schema."
                        }
                    ]
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: geminiResponseSchema,
                    maxOutputTokens: 1800,
                    temperature: 0.1
                }
            })
        });
    } catch (error) {
        console.error("Gemini network request failed:", error?.name || "Error");

        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            throw new Error("Gemini request timed out. Please try again.");
        }

        throw new Error("Could not connect to Gemini. Check your internet connection.");
    }

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        const providerMessage = String(
            body?.error?.message || "Unknown Gemini error"
        ).slice(0, 400);

        console.error("Gemini request failed", {
            status: response.status,
            message: providerMessage
        });

        if (response.status === 400) {
            throw new Error(
                "Gemini rejected the request or response schema. Check the backend log for details."
            );
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "Gemini authentication failed. Check GEMINI_API_KEY and project permissions."
            );
        }

        if (response.status === 404) {
            throw new Error(
                `Gemini model "${model}" was not found or is unavailable to this API project.`
            );
        }

        if (response.status === 429) {
            throw new Error(
                "Gemini quota or rate limit reached. Check your API usage and limits."
            );
        }

        throw new Error("Gemini could not interpret the instruction.");
    }

    const candidate = body?.candidates?.[0];

    if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error("Gemini response was truncated. Please try a shorter instruction.");
    }

    const outputText = candidate?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!outputText) {
        throw new Error(
            "Gemini returned no structured output. Check the response finish reason."
        );
    }

    let parsed;

    try {
        parsed = JSON.parse(outputText);
    } catch {
        throw new Error(
            "Gemini returned malformed JSON; no action was executed."
        );
    }

    return validateAIResult(parsed, command);
}
