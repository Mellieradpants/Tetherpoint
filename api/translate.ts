type TranslateBody = {
  text: string;
  language: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  ht: "Haitian Creole",
  pt: "Portuguese",
  fr: "French",
  ar: "Arabic",
  fa: "Persian / Farsi",
  prs: "Dari",
  ps: "Pashto",
  ur: "Urdu",
  hi: "Hindi",
  pa: "Punjabi",
  bn: "Bengali",
  zh: "Chinese (Simplified)",
  yue: "Cantonese",
  vi: "Vietnamese",
  ko: "Korean",
  tl: "Tagalog",
  my: "Burmese",
  ne: "Nepali",
  ru: "Russian",
  uk: "Ukrainian",
  tr: "Turkish",
  so: "Somali",
  am: "Amharic",
  ti: "Tigrinya",
  sw: "Swahili",
  rw: "Kinyarwanda",
};

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

function parseTranslateBody(rawBody: string): TranslateBody {
  const parsed = rawBody.trim() ? JSON.parse(rawBody) : {};
  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};

  return {
    text: typeof record.text === "string" ? record.text : "",
    language: typeof record.language === "string" ? record.language : "",
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  let body: TranslateBody;

  try {
    body = parseTranslateBody(await readRawBody(req));
  } catch (error) {
    sendJson(res, 400, {
      message: error instanceof Error ? error.message : "Invalid JSON request body.",
    });
    return;
  }

  const text = body.text.trim();
  const language = body.language.trim();
  const targetLanguage = LANGUAGE_NAMES[language];

  if (!text) {
    sendJson(res, 400, { message: "No plain meaning text was provided for translation." });
    return;
  }

  if (!targetLanguage) {
    sendJson(res, 400, { message: "Unsupported translation language." });
    return;
  }

  if (language === "en") {
    sendJson(res, 200, { translated_text: text, language: "en" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.TRANSLATION_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    sendJson(res, 500, {
      message: "OPENAI_API_KEY is not configured for post-meaning translation.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Translate the provided plain-meaning immigration or legal explanation into the requested language. Preserve the meaning, avoid adding new analysis, and return only the translated text.",
          },
          {
            role: "user",
            content: `Target language: ${targetLanguage}\n\nPlain meaning:\n${text}`,
          },
        ],
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      sendJson(res, response.status, {
        message: payload?.error?.message || "Translation request failed.",
      });
      return;
    }

    const translatedText = payload?.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      sendJson(res, 502, { message: "Translation response did not include translated text." });
      return;
    }

    sendJson(res, 200, {
      translated_text: translatedText,
      language,
      source_stage: "meaning",
    });
  } catch (error) {
    sendJson(res, 502, {
      message: error instanceof Error ? error.message : "Translation request failed.",
    });
  }
}
