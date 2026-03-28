import { ChatGoogle } from "@langchain/google";
import { ChatGroq } from "@langchain/groq";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type LLMProvider = "google" | "groq";

export function getLLM(provider: LLMProvider = (process.env.LLM_PROVIDER as LLMProvider) || "google"): BaseChatModel {
  if (provider === "groq") {
    return new ChatGroq({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return new ChatGoogle({
    model: "gemini-2.5-flash",
    temperature: 0,
  });
}

export const llm = getLLM();
