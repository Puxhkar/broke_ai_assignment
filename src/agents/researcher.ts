import { ChatGoogle } from "@langchain/google";
import { exaSearchTool } from "./tools/exa";
import { LeadState } from "./state";
import { createAgent } from "langchain";
import { z } from "zod";
import { SystemMessage } from "@langchain/core/messages";

const llm = new ChatGoogle({
  model: "gemini-2.5-flash",
  temperature: 0,
});

const businessProfileSchema = z.object({
  description: z.string(),
  sizeSignals: z.string(),
  digitalPresence: z.string(),
  toolsUsed: z.string(),
});

const researchAgent = createAgent({
  model: llm,
  tools: [exaSearchTool],
  systemPrompt: `You are an expert business researcher. 
                  Your task is to conduct deep research on the given company to understand its operations, scale, and tech stack.

                  PRO TIPS FOR ACCURACY:
                  1. Use category: "company" when searching for general business information and scale.
                  2. Use type: "deep" if you need thorough research on their technical systems or specific scale signals.
                  3. Be specific: Instead of just searching for the company name, search for "tech stack used at [Company]" or "[Company] employee count headquarters".

                  Extract:
                  1. Business Description: High-level USP and core industry.
                  2. Size Signals: Employee count, estimated revenue, or physical scale (branches, fleet).
                  3. Digital Presence: Main site, LinkedIn, and social links.
                  4. Tech Stack: Software they use (CRM, booking systems, marketing automation).

                  Provide a comprehensive research summary as text.`,
});

export async function researcherNode(state: typeof LeadState.State) {
  const { companyName, location } = state;

  const query = (location && location !== "Unknown") 
    ? `Research company "${companyName}" in/near "${location}"` 
    : `Find the headquarters and detailed business profile of company "${companyName}"`;

  const result = await researchAgent.invoke({
    messages: [{ role: "user", content: query }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;

  const structuredLlm = llm.withStructuredOutput(businessProfileSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("Extract the structured business profile from the research report. If scale/tech fields are thin, summarize what IS known but use 'Not found' if completely missing. Ensure 'Digital Presence' includes URLs."),
    { role: "user", content: finalAgentMessage }
  ]);

  return {
    businessProfile: finalStructured,
    messages: result.messages,
  };
}
