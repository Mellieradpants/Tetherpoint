import { enforceAnalyzeSecurity } from "./_shared/analyze-security";

type AnalyzeOptions = {
  run_meaning: boolean;
  run_origin: boolean;
  run_verification: boolean;
};

type AnalyzeBody = {
  content: string;
  content_type: string;
  options: AnalyzeOptions;
};

function getBackendConfig() {
  const apiBaseUrl =
    process.env.ANALYZE_API_BASE_URL ?? "https://anchored-flow-stack.onrender.com";
  const analyzeSecret = process.env.ANALYZE_SECRET ?? "";

  return {
    apiUrl: `${apiBaseUrl.replace(/\/+$/, "")}/analyze`,
    analyzeSecret,
  };
}

function sendJson(res: any, status: number, payload: Record<string, unknown>) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

async function readRawBody(req: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (error: Error) => {
      reject(error);
    });

    req.on("aborted", () => {
      reject(new Error("Request body was aborted."));
    });
  });
}

function parseAnalyzeBody(rawBody: string): AnalyzeBody {
  let parsed: unknown = {};

  if (rawBody.trim()) {
    parsed = JSON.parse(rawBody);
  }

  const body = parsed && typeof parsed === "object" ? parsed : {};
  const record = body as Record<string, unknown>;
  const rawOptions =
    record.options && typeof record.options === "object"
      ? (record.options as Record<string, unknown>)
      : {};

  return {
    content: typeof record.content === "string" ? record.content : "",
    content_type:
      typeof record.content_type === "string" ? record.content_type : "",
    options: {
      run_meaning: Boolean(rawOptions.run_meaning),
      run_origin: Boolean(rawOptions.run_origin),
      run_verification: Boolean(rawOptions.run_verification),
    },
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  let body: AnalyzeBody;

  try {
    const rawBody = await readRawBody(req);
    body = parseAnalyzeBody(rawBody);
  } catch (error) {
    sendJson(res, 400, {
      message:
        error instanceof Error ? error.message : "Invalid JSON request body.",
    });
    return;
  }

  const clientIpHeader = req.headers["x-forwarded-for"];
  const clientIp = Array.isArray(clientIpHeader)
    ? clientIpHeader[0]
    : clientIpHeader?.split(",")[0].trim() ?? "unknown";

  try {
    const security = enforceAnalyzeSecurity({
      content: body.content,
      content_type: body.content_type,
      options: body.options,
      clientIp,
    });

    if (security.reject) {
      sendJson(res, security.reject.status, { message: security.reject.message });
      return;
    }

    const { apiUrl, analyzeSecret } = getBackendConfig();

    if (!analyzeSecret) {
      sendJson(res, 500, {
        message: "ANALYZE_SECRET is not configured on the server.",
      });
      return;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-analyze-secret": analyzeSecret,
      },
      body: JSON.stringify({
        content: body.content,
        content_type: body.content_type,
        options: body.options,
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

      sendJson(res, response.status, { message });
      return;
    }

    try {
      sendJson(res, 200, JSON.parse(text));
    } catch {
      sendJson(res, 502, { message: "Backend returned invalid JSON." });
    }
  } catch (error) {
    sendJson(res, 502, {
      message:
        error instanceof Error
          ? error.message
          : "Analyze proxy request failed before backend completion.",
    });
  }
}
