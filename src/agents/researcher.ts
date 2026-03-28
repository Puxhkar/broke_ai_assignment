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
  refinedLocation: z.string().optional(),
});

const researchAgent = createAgent({
  model: llm,
  tools: [exaSearchTool],
  systemPrompt: `You are an expert business researcher. 
Conduct deep research to extract structured data about a company.

CRITICAL:
1. TECH STACK: Prefix with "Confirmed:" or "Inferred from public sources:".
2. HQ: If location is "Unknown", find the global headquarters first.`,
});

export async function researcherNode(state: typeof LeadState.State) {
  const { companyName, location } = state;
  
  const initialLogs = [`[Researcher] Starting deep research for "${companyName}"...`];
  if (location === "Unknown") {
    initialLogs.push(`[Researcher] Location is Unknown. Prioritizing global HQ discovery.`);
  }

  const query = `Research company "${companyName}" ${location !== "Unknown" ? `in ${location}` : ""}. Find summary, scale, tech stack, and HQ.`;

  const result = await researchAgent.invoke({
    messages: [{ role: "user", content: query }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;
  const structuredLlm = llm.withStructuredOutput(businessProfileSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("Extract business profile. Return HQ in 'refinedLocation' if found."),
    { role: "user", content: finalAgentMessage }
  ]);

  const outputLogs = [
    `[Researcher] Successfully extracted business profile for ${companyName}.`,
  ];
  if (finalStructured.refinedLocation) {
    outputLogs.push(`[Researcher] Identified HQ: ${finalStructured.refinedLocation}`);
  }

  return {
    businessProfile: finalStructured,
    discoveredLocation: finalStructured.refinedLocation,
    logs: [...initialLogs, ...outputLogs],
    messages: result.messages,
  };
}
