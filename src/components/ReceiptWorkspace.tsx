import { useState } from "react";
import { DocumentNavigator } from "./receipt-workspace/DocumentNavigator";
import type { PipelineResponse } from "../types/pipeline";

export type { PipelineResponse } from "../types/pipeline";

export function ReceiptWorkspace({ data }: { data: PipelineResponse }) {
  const [answerLanguage, setAnswerLanguage] = useState("en");

  return (
    <DocumentNavigator
      data={data}
      answerLanguage={answerLanguage}
      onAnswerLanguageChange={setAnswerLanguage}
    />
  );
}
