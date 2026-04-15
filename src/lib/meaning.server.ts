/**
 * Meaning layer — server-only OpenAI integration.
 * Analyses selected nodes to detect interpretive lenses (e.g. regulatory, scientific).
 * Never modifies source_text, node structure, or source anchors.
 */

interface MeaningNodeInput {
  node_id: string;
  source_text: string;
}

interface MeaningNodeResult {
  node_id: string;
  lenses: string[];
  summary: string | null;
}

interface MeaningResult {
  status: "executed" | "skipped" | "error";
  message: string;
  node_results: MeaningNodeResult[];
}

export async function runMeaningLayer(
  nodes: MeaningNodeInput[],
): Promise<MeaningResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { status: "skipped", message: "No OPENAI_API_KEY configured", node_results: [] };
  }

  if (nodes.length === 0) {
    return { status: "executed", message: "No selected nodes to analyse", node_results: [] };
  }

  console.info(`[meaning] Executing meaning layer on ${nodes.length} node(s)`);

  try {
    const nodesPayload = nodes.map((n) => `[${n.node_id}] ${n.source_text}`).join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `You are a document analysis assistant. For each numbered node, identify interpretive lenses (e.g. "regulatory", "scientific", "financial", "legal", "political", "technical", "statistical") and produce a one-sentence analytical summary. Return ONLY a JSON array where each element has: {"node_id": "...", "lenses": [...], "summary": "..."}. No markdown, no explanation.`,
          },
          {
            role: "user",
            content: nodesPayload,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      console.error(`[meaning] OpenAI API error: ${response.status} ${errorText}`);
      return {
        status: "error",
        message: `OpenAI API returned ${response.status}`,
        node_results: [],
      };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Parse the JSON array from the response
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed: MeaningNodeResult[] = JSON.parse(cleaned);

    // Validate and sanitise — only keep results for nodes we sent
    const validIds = new Set(nodes.map((n) => n.node_id));
    const results = parsed
      .filter((r) => validIds.has(r.node_id))
      .map((r) => ({
        node_id: r.node_id,
        lenses: Array.isArray(r.lenses) ? r.lenses.map(String) : [],
        summary: typeof r.summary === "string" ? r.summary : null,
      }));

    console.info(`[meaning] Meaning layer completed: ${results.length} node(s) analysed`);

    return {
      status: "executed",
      message: `Analysed ${results.length} node(s)`,
      node_results: results,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[meaning] Meaning layer failed: ${msg}`);
    return {
      status: "error",
      message: `Meaning layer failed: ${msg}`,
      node_results: [],
    };
  }
}
