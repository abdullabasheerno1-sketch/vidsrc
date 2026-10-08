import express, { json } from "express";
import cors from "cors";
import chromium from "@sparticuz/chromium";
import playwright from "playwright-core";
import pLimit from "p-limit";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { getTVSubtitleVTT } from "./utils/tvSubtitles.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
export const OPENSUB_API_KEY = process.env.OPENSUB_API_KEY;
export const TMDB_API_KEY = process.env.TMDB_API_KEY;
export const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN;

export const headers = {
  Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
  "Content-Type": "application/json;charset=utf-8",
};

app.use(cors());
app.use(json());

const PROVIDERS = [
  "https://vidsrc2.ru",
  "https://vidsrc.ir",
  "https://vidsrcme.ru",
  "https://vidsrcme.su",
  "https://vidsrc-me.ru",
  "https://vidsrc.me",
  "https://vidsrc.io",
  "https://vidsrc.tw"
];

export const LANGUAGE_NAMES = {
  en: "English",
};

export const COMMON_LANGUAGES = Object.keys(LANGUAGE_NAMES);

// Limit concurrent scraping to 2 providers at a time
const limit = pLimit(2);
const cache = new Map();

//Scraper util function optimized for Vercel
async function scrapeProvider(domain, url) {
  console.log(`\n[${domain}] Starting scrape for URL: ${url}`);
  
  let browser = null;
  let context = null;
  let page = null;

  try {
    // Vercel-compatible serverless browser launch
    browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      ignoreHTTPSErrors: true,
    });
    
    page = await context.newPage();

    let hlsUrl = null;
    const subtitles = [];

    const isSubtitle = (url) => {
      return /\.(vtt|srt)(\?.*)?$/.test(url) || url.includes(".vtt") || url.includes(".srt");
    };

    // Intercept requests
    await page.route("**/*", (route) => {
      const reqUrl = route.request().url();

      if (!hlsUrl && reqUrl.includes(".m3u8")) {
        hlsUrl = reqUrl;
        console.log(`[${domain}] Found HLS URL: ${hlsUrl}`);
      }

      if (isSubtitle(reqUrl) && !subtitles.includes(reqUrl)) {
        subtitles.push(reqUrl);
        console.log(`[${domain}] (route) Found subtitle URL: ${reqUrl}`);
      }

      route.continue();
    });

    page.on("request", (request) => {
      const reqUrl = request.url();
      if (isSubtitle(reqUrl) && !subtitles.includes(reqUrl)) {
        subtitles.push(reqUrl);
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log(`[${domain}] Page loaded`);

    const frameDiv = await page.waitForSelector("#the_frame", { timeout: 10000 });

    if (frameDiv) {
      const box = await frameDiv.boundingBox();

      if (box) {
        const clickX = box.x + box.width / 2;
        const clickY = box.y + box.height / 2;
        await page.mouse.move(clickX, clickY);
        await page.mouse.click(clickX, clickY);
      } else {
        await page.evaluate(() => {
          document.querySelector("#the_frame")?.click();
        });
      }

      await page.waitForTimeout(7000);

      if (!hlsUrl) {
        await page.waitForResponse((resp) => resp.url().includes(".m3u8"), { timeout: 5000 }).catch(() => {});
      }

      if (subtitles.length === 0) {
        await page.waitForTimeout(5000);
      }
    } else {
      throw new Error(`#the_frame div not found`);
    }

    await page.close().catch(() => {});
    await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});

    if (!hlsUrl) throw new Error("HLS URL not found");

    return { hls_url: hlsUrl, subtitles, error: null };
  } catch (error) {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    console.error(`[${domain}] Error: ${error.message}`);
    return { hls_url: null, subtitles: [], error: error.message };
  }
}

//Extract endpoint for m3u8 scraper
app.get("/extract", async (req, res) => {
  const type = req.query.type || "movie";
  const tmdb_id = req.query.tmdb_id;
  const season = req.query.season ? parseInt(req.query.season) : undefined;
  const episode = req.query.episode ? parseInt(req.query.episode) : undefined;

  if (!tmdb_id) {
    return res.status(400).json({ success: false, error: "tmdb_id query param is required", results: {} });
  }

  if (type === "tv" && (season == null || episode == null)) {
    return res.status(400).json({ success: false, error: "season and episode query params are required for TV shows", results: {} });
  }

  const cacheKey = JSON.stringify(req.query);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 15) {
    return res.json(cached.response);
  }

  const urls = PROVIDERS.reduce((acc, domain) => {
    acc[domain] = type === "tv"
      ? `${domain}/embed/tv?tmdb=${tmdb_id}&season=${season}&episode=${episode}`
      : `${domain}/embed/movie/${tmdb_id}`;
    return acc;
  }, {});

  try {
    const resultsArr = await Promise.all(
      Object.entries(urls).map(([domain, url]) =>
        limit(async () => {
          try {
            const result = await scrapeProvider(domain, url);
            return [domain, result];
          } catch (err) {
            return [domain, { hls_url: null, subtitles: [], error: err.message }];
          }
        })
      )
    );

    const results = Object.fromEntries(resultsArr);
    const success = Object.values(results).some((r) => r.hls_url);
    const response = { success, results };

    cache.set(cacheKey, { timestamp: Date.now(), response });
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: "Unexpected server error", results: {} });
  }
});

app.get("/", (req, res) => {
  res.send("🎬 VidSrc Scraper API is running on Vercel.");
});

// For local testing support
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

export default app;
