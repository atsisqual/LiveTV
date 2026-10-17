const BROWSER_FORBIDDEN = new Set(['user-agent', 'origin', 'referer', 'host', 'cookie']);

export function browserSafeHeaders(headers = {}) {
  const safe = {};
  const restricted = {};
  for (const [name, value] of Object.entries(headers || {})) {
    if (BROWSER_FORBIDDEN.has(name.toLowerCase())) restricted[name] = value;
    else safe[name] = value;
  }
  return { safe, restricted };
}

export function needsTransportProxy(headers = {}) {
  return Object.keys(browserSafeHeaders(headers).restricted).length > 0;
}

export function createRetryPolicy(input = {}) {
  return {
    maxAttempts: Math.max(1, Number(input.maxAttempts || 4)),
    baseDelayMs: Math.max(0, Number(input.baseDelayMs || 350)),
    maxDelayMs: Math.max(250, Number(input.maxDelayMs || 6000)),
    jitter: Math.min(0.9, Math.max(0, Number(input.jitter ?? 0.2)))
  };
}

export function retryDelay(attempt, policyInput = {}) {
  const policy = createRetryPolicy(policyInput);
  const raw = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** Math.max(0, attempt - 1)));
  const spread = raw * policy.jitter;
  return Math.max(0, Math.round(raw - spread + Math.random() * spread * 2));
}

export async function withRetry(task, policyInput = {}, onRetry = () => {}) {
  const policy = createRetryPolicy(policyInput);
  let lastError;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (error?.retryable === false || attempt >= policy.maxAttempts) break;
      const delay = retryDelay(attempt, policy);
      onRetry({ attempt, delay, error });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function resolveTransportUrl(profile, url, requestType, transportResolver) {
  if (!transportResolver) return url;
  const result = await transportResolver({ profile, url, requestType, headers: profile.headers });
  return typeof result === 'string' ? result : (result?.url || url);
}
