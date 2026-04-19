const MAX_CONTENT_LENGTH = 500_000;
const VALID_CONTENT_TYPES = new Set(["text", "html", "xml", "json"]);
const GENERAL_LIMIT = 30;
const MEANING_LIMIT = 5;
const WINDOW_MS = 60_000;

const generalBuckets = new Map<string, number[]>();
const meaningBuckets = new Map<string, number[]>();

function prune(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

function checkRateLimit(clientIp: string, wantsMeaning: boolean): string | null {
  const now = Date.now();

  let general = prune(generalBuckets.get(clientIp) ?? [], now);
  if (general.length >= GENERAL_LIMIT) {
    return `Rate limit exceeded: ${GENERAL_LIMIT} requests per ${WINDOW_MS / 1000}s`;
  }
  general.push(now);
  generalBuckets.set(clientIp, general);

  if (wantsMeaning) {
    let meaning = prune(meaningBuckets.get(clientIp) ?? [], now);
    if (meaning.length >= MEANING_LIMIT) {
      return `Meaning rate limit exceeded: ${MEANING_LIMIT} requests per ${WINDOW_MS / 1000}s`;
    }
    meaning.push(now);
    meaningBuckets.set(clientIp, meaning);
  }

  return null;
}

function enforceAnalyzeSecurity(input: {
  content: string;
  content_type: string;
  options: { run_meaning: boolean; run_origin: boolean; run_verification: boolean };
  clientIp?: string;
}) {
  const clientIp = input.clientIp ?? "unknown";
  const contentLen = input.content.length;

  if (!input.content || !input.content.trim()) {
    return { reject: { status: 400, message: "content must not be empty" }, meaningAllowed: false };
  }

  if (contentLen > MAX_CONTENT_LENGTH) {
    return {
      reject: {
        status: 413,
        message: `content too large: ${contentLen} bytes (max ${MAX_CONTENT_LENGTH})`,
      },
      meaningAllowed: false,
    };
  }

  if (!VALID_CONTENT_TYPES.has(input.content_type)) {
    return {
      reject: {
        status: 400,
        message: `Invalid content_type: must be one of ${[...VALID_CONTENT_TYPES].join(", ")}`,
      },
      meaningAllowed: false,
    };
  }

  let meaningAllowed = false;
  if (input.options.run_meaning) {
    const serverSecret = process.env.ANALYZE_SECRET ?? "";
    if (serverSecret) {
      meaningAllowed = true;
    }
  }

  const rateResult = checkRateLimit(clientIp, input.options.run_meaning && meaningAllowed);
  if (rateResult) {
    return { reject: { status: 429, message: rateResult }, meaningAllowed: false };
  }

  return { meaningAllowed };
}

function getBackendConfig() {
  const apiBaseUrl =
    process.env.ANALYZE_API_BASE_URL ??
    process.env.VITE_ANALYZE_API_BASE_URL ??
    "https://anchored-flow-stack.onrender.com";
  const analyzeSecret =
    process.env.ANALYZE_SECRET ?? process.env.VITE_ANALYZE_SECRET ?? "";

  return {
    apiUrl: `${apiBaseUrl.replace(/\/+$/, "")}/analyze`,
    analyzeSecret,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const body = req.body ?? {};
  const content = typeof body.content === "string" ? body.content : "";
  const contentType = typeof body.content_type === "string" ? body.content_type : "";
  const options = body.options ?? {
    run_meaning: false,
    run_origin: true,
    run_verification: true,
  };

  const clientIpHeader = req.headers["x-forwarded-for"];
  const clientIp = Array.isArray(clientIpHeader)
    ? clientIpHeader[0]
    : clientIpHeader?.split(",")[0].trim() ?? "unknown";

  const security = enforceAnalyzeSecurity({
    content,
    content_type: contentType,
    options,
    clientIp,
  });

  if (security.reject) {
    res.status(security.reject.status).json({ message: security.reject.message });
    return;
  }

  const { apiUrl, analyzeSecret } = getBackendConfig();

  if (!analyzeSecret) {
    res.status(500).json({ message: "ANALYZE_SECRET is not configured on the server." });
    return;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyze-secret": analyzeSecret,
      },
      body: JSON.stringify({
        content,
        content_type: contentType,
        options,
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      let message = `Backend analyze failed (${response.status})`;

      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === "string") {
          message = parsed.detail;
        } else if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) {
          message = parsed.detail[0].msg;
        } else if (Array.isArray(parsed?.errors) && parsed.errors[0]?.error) {
          message = parsed.errors[0].error;
        } else if (typeof parsed?.message === "string") {
          message = parsed.message;
        }
      } catch {
        if (text.trim()) {
          message = text;
        }
      }

      res.status(response.status).json({ message });
      return;
    }

    try {
      res.status(200).json(JSON.parse(text));
    } catch {
      res.status(502).json({ message: "Backend returned invalid JSON." });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analyze proxy request failed.";
    res.status(502).json({ message });
  }
}
