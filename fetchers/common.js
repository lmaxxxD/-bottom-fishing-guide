const https = require('https');
const http = require('http');

/**
 * Generic HTTPS GET with custom headers, timeout, and redirect support
 */
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      ...(options.headers || {})
    };

    const parsedUrl = new URL(url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;

    const req = mod.get(url, { headers, timeout: options.timeout || 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/**
 * Fetch JSON from URL
 */
async function fetchJSON(url, options = {}) {
  const raw = await httpGet(url, options);
  return JSON.parse(raw);
}

/**
 * Fetch JSONP (东方财富 cb=cb pattern)
 */
async function fetchJSONP(url, options = {}) {
  const raw = await httpGet(url, options);
  // Extract JSON from callback: cb({...})
  const match = raw.match(/^[^(]*\((.+)\)[;\s]*$/s);
  if (!match) throw new Error(`Invalid JSONP response from ${url}`);
  return JSON.parse(match[1]);
}

/**
 * Fetch plain text
 */
async function fetchText(url, options = {}) {
  return httpGet(url, options);
}

/**
 * Fetch with browser-like User-Agent
 */
async function fetchWithUA(url, options = {}) {
  return httpGet(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ...(options.headers || {})
    }
  });
}

/**
 * Simple Moving Average
 */
function simpleMA(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

/**
 * Percentile rank of value in array (0-100)
 */
function percentile(arr, value) {
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return (below / sorted.length) * 100;
}

/**
 * Linear map a value from [low, high] to [0, 100] (inverted: low value = high score)
 */
function linearScoreInverse(value, low, high) {
  if (value <= low) return 100;
  if (value >= high) return 0;
  return Math.round(((high - value) / (high - low)) * 100);
}

/**
 * Linear map a value from [low, high] to [0, 100] (normal: high value = high score)
 */
function linearScore(value, low, high) {
  if (value <= low) return 0;
  if (value >= high) return 100;
  return Math.round(((value - low) / (high - low)) * 100);
}

/**
 * Compute rolling MA array for the last N data points
 * Returns array of { date, ma } for each point where MA is computable
 */
function rollingMA(closes, dates, period) {
  const result = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push({ date: dates[i], value: sum / period });
  }
  return result;
}

module.exports = {
  fetchJSON, fetchJSONP, fetchText, fetchWithUA,
  simpleMA, percentile, linearScoreInverse, linearScore, rollingMA
};
