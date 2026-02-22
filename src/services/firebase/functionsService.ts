import { HttpsCallableResult, httpsCallable } from "firebase/functions";
import { assertFirebaseConfigured, firebaseFunctions } from "@/integrations/firebase/client";

// Interface for AI Responses
export interface AiResponse {
  answer: string;
}

export interface AnomalyAnalysis {
  isAnomalous: boolean;
  riskLevel: "low" | "medium" | "high" | "unknown";
  reason: string;
  suggestedAction?: string;
}

// Interface for Email
export interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
}

export interface AskAiOptions {
  context?: unknown;
  includeFinancialContext?: boolean;
  companyId?: string;
}

/**
 * Generic helper to call a Cloud Function
 */
export const callFunction = async <RequestBody, ResponseBody>(
  name: string,
  payload: RequestBody,
): Promise<ResponseBody> => {
  assertFirebaseConfigured();
  const callable = httpsCallable<RequestBody, ResponseBody>(firebaseFunctions, name);
  const result: HttpsCallableResult<ResponseBody> = await callable(payload);
  return result.data;
};

/**
 * Ask DeepSeek AI a financial question
 */
export const askAi = async (query: string, options?: AskAiOptions): Promise<string> => {
  const result = await callFunction<{ query: string; context?: unknown; includeFinancialContext?: boolean; companyId?: string }, AiResponse>("askDeepSeek", {
    query,
    context: options?.context,
    includeFinancialContext: options?.includeFinancialContext,
    companyId: options?.companyId,
  });
  return result.answer;
};

/**
 * Analyze a transaction for anomalies using DeepSeek
 */
export const analyzeAnomaly = async (transaction: Record<string, unknown>): Promise<AnomalyAnalysis> => {
  return await callFunction<{ transaction: Record<string, unknown> }, AnomalyAnalysis>("analyzeTransactionAnomaly", {
    transaction,
  });
};

/**
 * Send an email via Cloud Functions
 */
export const sendEmail = async (req: EmailRequest): Promise<EmailResponse> => {
  return await callFunction<EmailRequest, EmailResponse>("sendEmail", req);
};
