import { ChatGoogle } from "@langchain/google";
import { LeadState } from "./state";
import { z } from "zod";

const llm = new ChatGoogle({
  model: "gemini-2.5-flash",
  temperature: 0,
});

const outreachSchema = z.object({
  message: z.string().describe("The personalized outreach message."),
  reasoning: z.string().describe("Explanation: why this message is effective for this lead?"),
});

export async function outreachWriterNode(state: typeof LeadState.State) {
  const { companyName, businessProfile, contactCard } = state;

  const initialLogs = [`[OutreachWriter] Crafting personalized message for ${companyName}...`];

  const prompt = `
    You are a world-class sales copywriter.
    Create a personalized outreach message for ${companyName}.
    
    RESEARCH:
    - Summary: ${businessProfile.description}
    - Scale: ${businessProfile.sizeSignals}
    - Tech: ${businessProfile.toolsUsed}
    
    CONTACT:
    - Email: ${contactCard.email}
    
    GOAL: Generate an outcome-first message and explain your reasoning (e.g. "Focused on their scale because...").
  `;

  const structuredLlm = llm.withStructuredOutput(outreachSchema);
  const result = await structuredLlm.invoke(prompt);

  return {
    outreachMessage: result.message,
    outreachReasoning: result.reasoning,
    logs: [...initialLogs, `[OutreachWriter] Message finalized with personalized reasoning.`],
  };
}
