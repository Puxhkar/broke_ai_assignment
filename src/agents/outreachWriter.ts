import { LeadState } from "./state";
import { z } from "zod";
import { retryWithWait } from "../lib/retry";
import { llm } from "./llm";

const outreachSchema = z.object({
  message: z.string().describe("The personalized outreach message."),
  reasoning: z.string().describe("Explanation: why this message is effective for this lead?"),
});

export async function outreachWriterNode(state: typeof LeadState.State) {
  const { companyName, businessProfile } = state;

  const initialLogs = [`[OutreachWriter] Crafting personalized message for ${companyName}...`];

  const prompt = `
    You are an Outreach Expert at Brokai Labs. 
    Brokai Labs is an AI systems company that builds:
    - AI Voice Receptionists (to handle calls 24/7)
    - Custom SaaS platforms
    - Automation tools for SMBs (Small-to-Medium Businesses)

    YOUR GOAL: Generate a personalized WhatsApp-style cold outreach message for ${companyName}.

    LEAD RESEARCH DATA:
    - Company: ${companyName}
    - What they do: ${businessProfile.description}
    - Scale & Digital Presence: ${businessProfile.sizeSignals} | ${businessProfile.digitalPresence}
    - Current Tools: ${businessProfile.toolsUsed}

    WHATSAPP-STYLE RULES:
    1. SHORT: Maximum 2-3 sentences.
    2. OUTCOME-FIRST: Focus immediately on the value (e.g., "stopping missed calls" or "automating [specific process]").
    3. PERSONALIZED: Mention a specific detail from their business (e.g., their specific products or a tool they use).
    4. NO FORMALITIES: Don't use "Dear [Name]" or "I hope you are well". Start with a quick "Hi" or just get straight to the point.
    5. CALL TO ACTION: A simple, low-friction question (e.g., "Worth a quick chat?").
    6. IDENTITY: Make sure it's clear it's from Brokai Labs.

    EXAMPLE STYLE:
    "Hi, noticed you're scaling your organic skincare line. We're helping companies like yours at Brokai Labs by building AI receptionists so you never miss a customer inquiry. Would you be open to a 2-min chat about automating your booking process?"
  `;

  const structuredLlm = llm.withStructuredOutput(outreachSchema);
  const result = await retryWithWait(() => structuredLlm.invoke(prompt));

  return {
    outreachMessage: result.message,
    outreachReasoning: result.reasoning,
    logs: [...initialLogs, `[OutreachWriter] Message finalized with personalized reasoning.`],
  };
}
