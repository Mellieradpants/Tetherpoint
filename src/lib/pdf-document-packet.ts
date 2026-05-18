import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfTextItem = {
  str: string;
  hasEOL?: boolean;
};

export interface DocumentPacketBlock {
  block_id: string;
  block_type: "text";
  text: string;
  source_anchor: {
    document_id: string;
    page_number: number;
    block_id: string;
  };
}

export interface DocumentPacket {
  document_id: string;
  source_type: "pdf";
  source_name: string;
  pages: Array<{
    page_number: number;
    blocks: DocumentPacketBlock[];
  }>;
}

export class PdfNoExtractableTextError extends Error {
  constructor() {
    super("No extractable text found. Text-based PDFs only; scanned PDFs are not supported.");
    this.name = "PdfNoExtractableTextError";
  }
}

function makeDocumentId(fileName: string) {
  const baseName = fileName.replace(/\.pdf$/i, "") || "document";
  const safeName =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "document";

  return `pdf-${safeName}-${Date.now()}`;
}

function textItemsToPageText(items: PdfTextItem[]) {
  return items.map((item) => `${item.str}${item.hasEOL ? "\n" : ""}`).join("");
}

export async function pdfFileToDocumentPacket(file: File): Promise<DocumentPacket> {
  const documentId = makeDocumentId(file.name);
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: DocumentPacket["pages"] = [];
  let extractableTextFound = false;

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const text = textItemsToPageText(textContent.items as PdfTextItem[]);
    const blockId = `page-${String(pageIndex).padStart(4, "0")}-block-0001`;

    if (text.trim()) {
      extractableTextFound = true;
    }

    pages.push({
      page_number: pageIndex,
      blocks: [
        {
          block_id: blockId,
          block_type: "text",
          text,
          source_anchor: {
            document_id: documentId,
            page_number: pageIndex,
            block_id: blockId,
          },
        },
      ],
    });
  }

  if (!extractableTextFound) {
    throw new PdfNoExtractableTextError();
  }

  return {
    document_id: documentId,
    source_type: "pdf",
    source_name: file.name,
    pages,
  };
}
