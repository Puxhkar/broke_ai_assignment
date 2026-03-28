import { exaSearchTool } from "./tools/exa";
import { LeadState } from "./state";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { retryWithWait } from "../lib/retry";
import { llm } from "./llm";

const businessProfileSchema = z.object({
  description: z.string(),
  sizeSignals: z.string(),
  digitalPresence: z.string(),
  toolsUsed: z.string(),
  refinedLocation: z.string().optional(),
  officialWebsite: z.string().optional().describe("The official company website URL"),
});

export async function researcherNode(state: typeof LeadState.State) {
  const { companyName, location } = state;

  const researchSystemPrompt = `You are a precision-focused Lead Research Agent.
  Your goal is to find accurate, non-generic information about "${companyName}" in "${location}".

  STRATEGY:
  1. SEARCH: Use multiple searches to find the official website, LinkedIn, and local directories (e.g., Justdial, Indiamart, Facebook).
  2. DETECT PLACEHOLDERS: If you find "Nginx", "Fedora", "Apache", or "Test Page", the website is a PLACEHOLDER. Do NOT use it for your description.
  3. PIVOT: If the website is a placeholder or missing, search for the company on business directories (Justdial, Indiamart) or Social Media (Facebook, Instagram) to get the REAL business description.
  4. VERIFY: Confirm the company matches "${companyName}" and "${location}".

  CRITICAL:
  - DESCRIPTION: Must be what they actually do (e.g., "Two-wheeler showroom", "Textile manufacturer").
  - AVOID: Do not mention server software (Nginx, Fedora) in the description.
  - HQ: Find the exact address if possible.

  If you cannot find a functional website, return "N/A" for the website but still find the business description from other sources.`;

  const initialLogs = [`[Researcher] Starting deep research for "${companyName}" in ${location}...`];

  const agent = createAgent({
    model: llm,
    tools: [exaSearchTool],
    systemPrompt: researchSystemPrompt,
    responseFormat: businessProfileSchema,
  });

  const query = `Research company "${companyName}" in "${location}". Find official website, business summary, scale, and social media. If website is missing or a test page, check Justdial, Indiamart, and Facebook.`;

  const result = await retryWithWait(() => agent.invoke({
    messages: [new HumanMessage(query)]
  }));

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;
  const structuredLlm = llm.withStructuredOutput(businessProfileSchema);

  const finalStructured = await retryWithWait(() => structuredLlm.invoke([
    new SystemMessage("Extract business profile from the research. If info is missing, use 'Not found' or 'N/A' for website."),
    { role: "user", content: finalAgentMessage }
  ]));

  const outputLogs = [
    `[Researcher] Successfully extracted business profile for ${companyName}.`,
  ];
  if (finalStructured.refinedLocation) {
    outputLogs.push(`[Researcher] Identified HQ: ${finalStructured.refinedLocation}`);
  }

  return {
    businessProfile: finalStructured,
    discoveredLocation: finalStructured.refinedLocation,
    websiteUrl: finalStructured.officialWebsite,
    logs: [...initialLogs, ...outputLogs],
    // messages: result.messages, // REMOVED to save tokens/TPM
  };
}
