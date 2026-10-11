
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        provider: "serpapi",
        configured: Boolean(process.env.SERPAPI_KEY)
    });
});

app.get("/api/commerce/search", async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query || query.length > 150) {
        return res.status(400).json({
            error: "Enter a query of 1–150 characters."
        });
    }

    if (!process.env.SERPAPI_KEY) {
        return res.status(503).json({
            error: "SERPAPI_KEY is not configured."
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
            signal: AbortSignal.timeout(20000)
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error("SerpApi request failed:", {
                status: response.status,
                error: data.error || "Unknown provider error",
            });

            return res.status(502).json({
                error: "Shopping provider request failed.",
                providerStatus: response.status,
                details: data.error || "Unknown provider error",
            });
        }

        const products = (data.shopping_results || []).map((item) => ({
            id: String(item.product_id || item.position || item.title),
            name: item.title || "Unnamed product",
            priceText: item.price || null,
            price: null,
            currency: "INR",
            merchant: item.source || null,
            image: item.thumbnail || null,
            url: item.product_link || item.link || null,
            rating: item.rating ?? null,
            source: "Google Shopping"
        }));

        res.json({
            provider: "serpapi",
            live: true,
            fetchedAt: new Date().toISOString(),
            count: products.length,
            products
        });
    } catch (error) {
        console.error("Shopping search error:", error.message);
        res.status(502).json({
            error: "Could not retrieve shopping results."
        });
    }
});

app.listen(PORT, () => {
    console.log(`AIP API running at http://localhost:${PORT}`);
});
