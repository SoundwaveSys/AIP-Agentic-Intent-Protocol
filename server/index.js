import express from "express";
import dotenv from "dotenv";
import { createAgentPlan } from "./aiAgent.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT) || 3001;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Lightweight in-memory rate limiter. Use a shared store such as Redis
// if you deploy multiple server instances.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const requestCounts = new Map();

app.use("/api/commerce/search", (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = requestCounts.get(key);

    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        requestCounts.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS);
    res.setHeader("RateLimit-Remaining", Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count));
    res.setHeader("RateLimit-Reset", Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({
            error: "Too many search requests. Please wait a minute and try again."
        });
    }

    next();
});

// Clean up expired entries so the map does not grow indefinitely.
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCounts.entries()) {
        if (now >= entry.resetAt) requestCounts.delete(key);
    }
}, RATE_LIMIT_WINDOW_MS).unref();

function parsePrice(priceText) {
    if (typeof priceText !== "string") return null;

    const normalized = priceText.replace(/\u00a0/g, " ").trim();
    const match = normalized.match(/(?:₹|INR|Rs\.?\s*)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!match) return null;

    const value = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(value) && value > 0 ? value : null;
}

function safeProductId(item, index) {
    return String(item.product_id ?? item.position ?? item.title ?? `result-${index + 1}`).slice(0, 200);
}

// AI intent extraction + allowlisted multi-step plan. The cloud key remains server-side.
app.post("/api/agent/intent", async (req, res) => {
    const command = typeof req.body?.command === "string" ? req.body.command : "";
    if (!command.trim() || command.length > 2000) {
        return res.status(400).json({ error: "Enter an instruction of 1–2000 characters." });
    }
    try {
        const result = await createAgentPlan(command);
        res.setHeader("Cache-Control", "no-store");
        return res.json(result);
    } catch (error) {
        const message = String(error?.message || "Cloud AI request failed.");
        const status = message.includes("not configured") ? 503 :
            message.includes("characters") || message.includes("instruction") ? 400 : 502;
        return res.status(status).json({ error: message });
    }
});

app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
        ok: true,
        provider: "serpapi",
        configured: Boolean(process.env.SERPAPI_KEY)
    });
});

app.get("/api/commerce/search", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query || query.length > 150) {
        return res.status(400).json({
            error: "Enter a query of 1–150 characters."
        });
    }

    if (!process.env.SERPAPI_KEY) {
        return res.status(503).json({
            error: "Shopping search is not configured on the server."
        });
    }

    try {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", "google_shopping");
        url.searchParams.set("q", query);
        url.searchParams.set("gl", "in");
        url.searchParams.set("hl", "en");
        url.searchParams.set("api_key", process.env.SERPAPI_KEY);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(20_000)
        });

        let data;
        try {
            data = await response.json();
        } catch {
            return res.status(502).json({
                error: "Shopping provider returned an invalid response."
            });
        }

        if (!response.ok || data?.error) {
            console.error("SerpApi request failed:", {
                status: response.status,
                error: String(data?.error || "Unknown provider error").slice(0, 300)
            });

            return res.status(502).json({
                error: "Shopping provider request failed. Please try again."
            });
        }

        const results = Array.isArray(data.shopping_results) ? data.shopping_results : [];
        const products = results.map((item, index) => {
            const priceText = typeof item.price === "string" ? item.price : null;

            return {
                id: safeProductId(item, index),
                name: typeof item.title === "string" ? item.title : "Unnamed product",
                price: parsePrice(priceText),
                priceText,
                currency: "INR",
                merchant: typeof item.source === "string" ? item.source : null,
                image: typeof item.thumbnail === "string" ? item.thumbnail : null,
                url: typeof item.product_link === "string"
                    ? item.product_link
                    : (typeof item.link === "string" ? item.link : null),
                rating: item.rating != null && Number.isFinite(Number(item.rating))
                    ? Number(item.rating)
                    : null,
                source: "Google Shopping",
                // Search snippets alone do not prove that specifications are verified.
                specifications: null,
                specificationsVerified: false
            };
        });

        res.setHeader("Cache-Control", "no-store");
        return res.json({
            provider: "serpapi",
            live: true,
            fetchedAt: new Date().toISOString(),
            query,
            count: products.length,
            products
        });
    } catch (error) {
        const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";

        console.error("Shopping search error:", {
            name: error?.name || "Error",
            message: String(error?.message || "Unknown error").slice(0, 300)
        });

        return res.status(502).json({
            error: isTimeout
                ? "Shopping search timed out. Please try again."
                : "Could not retrieve shopping results."
        });
    }
});

app.use((err, _req, res, _next) => {
    console.error("Unhandled API error:", String(err?.message || err).slice(0, 300));
    res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
    console.log(`AIP API running at http://localhost:${PORT}`);
});
