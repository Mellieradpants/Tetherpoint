import { useEffect, useRef } from "react";
import { ReceiptWorkspace, type PipelineResponse } from "./ReceiptWorkspace";

const TEXT_REPLACEMENTS = new Map([
  ["Reference Resolution", "Extended Meaning"],
  ["Resolve reference", "Generate Extended Meaning"],
  ["Resolving...", "Generating..."],
  ["Combined plain meaning", "Extended Meaning"],
  ["reference:", "extended meaning:"],
  ["Reference resolution failed.", "Extended meaning failed."],
  ["Source-Backed Details", "Details"],
  ["View source text used for the meaning result", "View source text used for this result"],
  [
    "Paste the referenced source text here to resolve how it contributes to the current rule. This first prototype does not fetch outside law automatically.",
    "Uses referenced source text you provide to show how outside references connect to the current rule.",
  ],
]);

function replaceVisibleText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const original = node.textContent ?? "";
    const replaced = Array.from(TEXT_REPLACEMENTS).reduce(
      (value, [from, to]) => value.replaceAll(from, to),
      original
    );

    if (replaced !== original) {
      node.textContent = replaced;
    }

    node = walker.nextNode();
  }
}

export function ExtendedMeaningWorkspace({ data }: { data: PipelineResponse }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    replaceVisibleText(root);

    const observer = new MutationObserver(() => replaceVisibleText(root));
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [data]);

  return (
    <div ref={rootRef}>
      <ReceiptWorkspace data={data} />
    </div>
  );
}

export type { PipelineResponse };
