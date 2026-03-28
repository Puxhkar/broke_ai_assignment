let lastCallTime = 0;
const MIN_INTERVAL = 2000;

export async function retryWithWait<T>(fn: () => Promise<T>, retries = 7): Promise<T> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_INTERVAL) {
    const sleepTime = MIN_INTERVAL - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, sleepTime));
  }
  lastCallTime = Date.now();

  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.response?.status || error?.data?.error?.status;
    const errorMsg = 
      error?.message || 
      error?.data?.error?.message || 
      (typeof error === 'string' ? error : JSON.stringify(error));
    
    console.log(`[Retry Utility] Detected Error (Status: ${status}):`, errorMsg);

    // If it's a 429, 413 (TPM limit on Groq), or mentions rate limit, we need to wait
    const isRateLimit = status === 429 || 
                        status === 413 ||
                        errorMsg.toLowerCase().includes("rate limit") || 
                        errorMsg.toLowerCase().includes("too many requests") ||
                        errorMsg.toLowerCase().includes("quota") ||
                        errorMsg.toLowerCase().includes("limit") ||
                        errorMsg.toLowerCase().includes("exhausted");

    if (retries > 0 && isRateLimit) {
      // Look for explicit retry-after hints
      const match = errorMsg.match(/retry in ([\d.]+)s/i) || errorMsg.match(/wait ([\d.]+)s/i);
      
      let waitMs: number;
      if (match) {
        waitMs = (parseFloat(match[1]) + 2) * 1000; // Buffer slightly more
      } else {
        // Exponential backoff with jitter: 4s, 8s, 16s, 32s...
        const baseBackoff = Math.pow(2, 8 - retries) * 1000; 
        const jitter = Math.random() * 2000;
        waitMs = baseBackoff + jitter + 3000;
      }

      console.log(`[Rate Limit] Hit. Waiting ${Math.round(waitMs/1000)}s before retry ${8 - retries}...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return retryWithWait(fn, retries - 1);
    }
    
    throw error;
  }
}
