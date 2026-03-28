import { ChatGoogle } from "@langchain/google";
import { exaSearchTool } from "./tools/exa";
import { LeadState } from "./state";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

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

const researchSystemPrompt = `You are an expert business researcher. 
Conduct deep research to extract structured data about a company.

CRITICAL:
1. TECH STACK: Prefix with "Confirmed:" or "Inferred from public sources:".
2. HQ: If location is "Unknown", find the global headquarters first.`;

export async function researcherNode(state: typeof LeadState.State) {
  const { companyName, location } = state;
  
  const initialLogs = [`[Researcher] Starting deep research for "${companyName}"...`];
  if (location === "Unknown") {
    initialLogs.push(`[Researcher] Location is Unknown. Prioritizing global HQ discovery.`);
  }

  const query = `Research company "${companyName}" ${location !== "Unknown" ? `in ${location}` : ""}. Find summary, scale, tech stack, and HQ.`;

  // Create a React agent for the Tool-Response loop
  const agent = createReactAgent({
    llm,
    tools: [exaSearchTool],
    messageModifier: researchSystemPrompt,
  });

  const result = await agent.invoke({
    messages: [new HumanMessage(query)]
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
