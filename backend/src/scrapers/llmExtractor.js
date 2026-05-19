const OpenAI = require('openai');
const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const AICache = require('../utils/aiCache');

// =============================================================================
// PROVIDER INITIALIZATIONS
// =============================================================================
const LOCAL_LLM_BASE_URL = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1';

// Shared Ollama client
const ollama = new OpenAI({ baseURL: LOCAL_LLM_BASE_URL, apiKey: 'ollama' });

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy' });

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy');

// OpenAI client (optional future-proofing)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

// =============================================================================
// LOCAL OLLAMA TIER MODELS
// =============================================================================
const FAST_MODEL = process.env.FAST_LLM_MODEL || 'phi3';
const QUALITY_MODEL = process.env.QUALITY_LLM_MODEL || 'llama3.2';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_MAX = 200;
function _cacheKey(text) {
    return crypto.createHash('md5').update(text.slice(0, 500)).digest('hex');
}
function _cacheGet(key) { return _cache.get(key) || null; }
function _cacheSet(key, value) {
    if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
    _cache.set(key, value);
}

// ─── Rate Limit Buckets ───────────────────────────────────────────────────────
const _RATE_LIMIT_BUCKETS = {
    fast: { tokens: 50, max: 50, refillMs: 60_000, lastRefill: Date.now() },
    quality: { tokens: 20, max: 20, refillMs: 60_000, lastRefill: Date.now() },
    groq: { tokens: 25, max: 25, refillMs: 60_000, lastRefill: Date.now() }
};

Object.keys(_RATE_LIMIT_BUCKETS).forEach(provider => {
    setInterval(() => {
        const bucket = _RATE_LIMIT_BUCKETS[provider];
        bucket.tokens = bucket.max;
        bucket.lastRefill = Date.now();
    }, _RATE_LIMIT_BUCKETS[provider].refillMs).unref();
});

async function _acquireToken(provider) {
    const bucket = _RATE_LIMIT_BUCKETS[provider];
    if (!bucket) return;
    while (bucket.tokens <= 0) {
        await new Promise(r => setTimeout(r, 2000));
    }
    bucket.tokens--;
}

// ─── Exponential-Backoff Wrapper ──────────────────────────────────────────────
async function _withRetry(fn, label = 'LLM', maxRetries = 3) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const msg = err?.message || '';
            const isRateLimit = err?.status === 429 || /429|rate.?limit|resource_exhausted/i.test(msg);
            const isQuotaExhausted = /quota.?exceeded|limit.?0/i.test(msg);

            if (isQuotaExhausted) throw err; // Hard limit

            if (!isRateLimit || attempt === maxRetries) throw err;

            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[${label} RateLimit] Retry ${attempt}/${maxRetries} after ${delay}ms — ${msg}`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

// ─── Shared Text Helpers ──────────────────────────────────────────────────────
function cleanTextResponse(text) {
    return text.replace(/```[a-z]*\n?/gi, '').replace(/```/gi, '').trim();
}

function cleanJsonResponse(text) {
    let cleaned = cleanTextResponse(text);
    const jsonStart = cleaned.indexOf('[');
    const jsonEnd = cleaned.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    return cleaned;
}

// ─── Fuzzy Field Normalizer ───────────────────────────────────────────────────
function normalizeExtractedData(item) {
    return {
        business_name: item.business_name || item.name || item.businessName || item.company_name || item.organization || 'Unknown Business',
        phone: item.phone || item.phoneNumber || item.contact || item.mobile || item.tele || null,
        email: item.email || item.email_address || item.contact_email || null,
        website: item.website || item.url || item.link || item.site || null,
        location: item.location || item.address || item.city || null,
        source: item.source || 'LLM Extraction'
    };
}

// =============================================================================
// TIER 2: Fast Extraction (phi3 local, no cloud fallback)
// =============================================================================
const EXTRACTION_PROMPT = `
You are an expert data extraction engine. Extract high-precision business information from the provided raw text.
Return ONLY a valid JSON array of objects.
TEXT TO PROCESS:
{TEXT}
`;

async function _extractWithFastModel(pageText) {
    await _acquireToken('fast');
    return _withRetry(async () => {
        const slicedText = pageText.slice(0, 20000);
        const completion = await ollama.chat.completions.create({
            messages: [{ role: 'user', content: EXTRACTION_PROMPT.replace('{TEXT}', slicedText) }],
            model: FAST_MODEL,
            temperature: 0,
        });
        const text = completion.choices[0]?.message?.content || '';
        const rawResults = JSON.parse(cleanJsonResponse(text));
        return Array.isArray(rawResults) ? rawResults.map(normalizeExtractedData) : [];
    }, `Ollama/${FAST_MODEL}`);
}

// =============================================================================
// TIER 1: Regex — pure string matching, zero LLM
// =============================================================================
function extractWithRegex(text) {
    const phoneRegex = /(?:\+\d{1,3}[\s\-.]?)?(?:\(?\d{1,4}\)?[\s\-.]?){1,4}\d{4,10}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phones = [...new Set(text.match(phoneRegex) || [])]
        .map(p => p.trim())
        .filter(p => p.replace(/\D/g, '').length >= 7);
    const emails = [...new Set(text.match(emailRegex) || [])].map(e => e.trim());
    if (phones.length > 0 || emails.length > 0) {
        return [{ business_name: 'Contact from Snippet', phone: phones[0] || null, email: emails[0] || null, source: 'Regex Extraction' }];
    }
    return [];
}

/**
 * Main business data extractor.
 * Waterfall: phi3 (Tier 2) → Regex (Tier 1)
 */
async function extractBusinessData(pageText) {
    if (!pageText || pageText.trim().length === 0) return [];

    const cacheKey = _cacheKey(pageText);
    const cached = _cacheGet(cacheKey);
    if (cached) return cached;

    try {
        const results = await _extractWithFastModel(pageText);
        if (results.length > 0) { _cacheSet(cacheKey, results); return results; }
        throw new Error('No results');
    } catch (err) {
        console.warn(`[LLM Extract] phi3 failed (${err.message}), falling back to Regex.`);
    }

    const results = extractWithRegex(pageText);
    if (results.length > 0) _cacheSet(cacheKey, results);
    return results;
}

// ─── Page Navigator ───────────────────────────────────────────────────────────
async function searchAndExtract(page, url, logFn = console.log) {
    try {
        logFn(`[searchAndExtract] Navigating to: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(randomBetween(2000, 3000));
        const pageText = await page.evaluate(() => document.body.innerText);
        const lowerText = pageText.toLowerCase();
        if (lowerText.includes('unusual traffic') || lowerText.includes('captcha')) return [];
        return await extractBusinessData(pageText.slice(0, 50000));
    } catch (err) {
        logFn(`[searchAndExtract] Failed on ${url}: ${err.message}`);
        return [];
    }
}

// =============================================================================
// DRY CORE LLM ROUTER (Supports Gemini, Groq, OpenAI, Ollama)
// =============================================================================
async function callLLM(customPrompt, options = {}) {
    const { 
        tier = 'fast', 
        isJson = false, 
        forceProvider = null 
    } = options;

    const provider = forceProvider || process.env.LLM_PROVIDER || 'ollama';

    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [LLM] Executing task via provider "${provider.toUpperCase()}" (Tier: ${tier}, JSON: ${isJson})`);

    switch (provider) {
        case 'gemini':
            if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured in env');
            return await _withRetry(async () => {
                const model = genAI.getGenerativeModel({
                    model: "gemini-flash-latest",
                    generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
                });
                const result = await model.generateContent(customPrompt);
                return cleanTextResponse(result.response.text());
            }, 'Gemini/Flash-Latest');

        case 'groq':
            if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured in env');
            await _acquireToken('groq');
            return await _withRetry(async () => {
                const completion = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: customPrompt }],
                    model: GROQ_MODEL,
                    temperature: 0,
                    response_format: isJson ? { type: "json_object" } : undefined
                });
                return cleanTextResponse(completion.choices[0]?.message?.content || '');
            }, `Groq/${GROQ_MODEL}`);

        case 'openai':
            if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured in env');
            return await _withRetry(async () => {
                const completion = await openai.chat.completions.create({
                    messages: [{ role: 'user', content: customPrompt }],
                    model: 'gpt-4o-mini',
                    temperature: 0,
                    response_format: isJson ? { type: "json_object" } : undefined
                });
                return cleanTextResponse(completion.choices[0]?.message?.content || '');
            }, 'OpenAI/gpt-4o-mini');

        case 'ollama':
        default:
            const modelName = tier === 'fast' ? FAST_MODEL : QUALITY_MODEL;
            await _acquireToken(tier);
            return await _withRetry(async () => {
                const completion = await ollama.chat.completions.create({
                    messages: [{ role: 'user', content: customPrompt }],
                    model: modelName,
                    temperature: 0,
                });
                return cleanTextResponse(completion.choices[0]?.message?.content || '');
            }, `Ollama/${modelName}`);
    }
}

// =============================================================================
// PUBLIC INTERFACES
// =============================================================================

/**
 * public fastPrompt — Tier 2 (phi3 / classification, enrichment, summarization)
 * Routes to LLM_PROVIDER, falls back gracefully to Local Ollama/Phi3 on failure.
 */
async function fastPrompt(customPrompt) {
    const cached = await AICache.get(customPrompt);
    if (cached) return cached;

    try {
        const responseText = await callLLM(customPrompt, { tier: 'fast', isJson: false });
        if (responseText) await AICache.set(customPrompt, responseText);
        return responseText;
    } catch (err) {
        console.warn(`[Fast Prompt] Provider ${process.env.LLM_PROVIDER || 'ollama'} failed (${err.message}). Falling back to Local Ollama/${FAST_MODEL}...`);
        try {
            const responseText = await callLLM(customPrompt, { tier: 'fast', isJson: false, forceProvider: 'ollama' });
            if (responseText) await AICache.set(customPrompt, responseText);
            return responseText;
        } catch (ollamaErr) {
            console.error(`[Fast Prompt] Fallback also failed: ${ollamaErr.message}`);
            throw ollamaErr;
        }
    }
}

/**
 * public generalPrompt — Tier 3 (llama3.2 / outreach generation, reply drafting, personalization)
 * Routes to LLM_PROVIDER, falls back to Groq Cloud, then falls back to Local Ollama/Llama3.2.
 */
async function generalPrompt(customPrompt, task = 'complex') {
    const cached = await AICache.get(customPrompt);
    if (cached) return cached;

    const isJson = customPrompt.includes('JSON');
    const primaryProvider = process.env.LLM_PROVIDER || 'ollama';

    try {
        const responseText = await callLLM(customPrompt, { tier: 'quality', isJson });
        if (responseText) await AICache.set(customPrompt, responseText);
        return responseText;
    } catch (err) {
        console.warn(`[Quality Prompt] Primary provider ${primaryProvider} failed (${err.message}).`);

        // If primary was already Groq, fall back directly to Local Ollama
        if (primaryProvider === 'groq') {
            console.warn(`[Quality Prompt] Falling back directly to Local Ollama/${QUALITY_MODEL}...`);
            try {
                const responseText = await callLLM(customPrompt, { tier: 'quality', isJson, forceProvider: 'ollama' });
                if (responseText) await AICache.set(customPrompt, responseText);
                return responseText;
            } catch (ollamaErr) {
                console.error(`[Quality Prompt] Fallback to Local Ollama also failed: ${ollamaErr.message}`);
                throw ollamaErr;
            }
        }

        // If primary was NOT Groq (e.g. Gemini/OpenAI), try Groq Cloud first, then Local Ollama
        console.warn(`[Quality Prompt] Falling back to Groq Cloud...`);
        try {
            const responseText = await callLLM(customPrompt, { tier: 'quality', isJson, forceProvider: 'groq' });
            if (responseText) await AICache.set(customPrompt, responseText);
            return responseText;
        } catch (groqErr) {
            console.warn(`[Quality Prompt] Groq Cloud fallback failed (${groqErr.message}). Falling back to Local Ollama/${QUALITY_MODEL}...`);
            try {
                const responseText = await callLLM(customPrompt, { tier: 'quality', isJson, forceProvider: 'ollama' });
                if (responseText) await AICache.set(customPrompt, responseText);
                return responseText;
            } catch (ollamaErr) {
                console.error('[Quality Prompt] All LLM providers (Primary, Groq, Ollama) failed.');
                throw ollamaErr;
            }
        }
    }
}

module.exports = { extractBusinessData, searchAndExtract, fastPrompt, generalPrompt };