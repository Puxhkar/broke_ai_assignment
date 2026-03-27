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
                  Your task is to conduct deep research on the given company to understand its operations and scale.

                  Extract the following:
                  1. Business Description: What they do, their USP, and core industry.
                  2. Size Signals: Employee counts, estimated revenue, or physical scale (number of branches, fleet size, etc.).
                  3. Digital Presence: Main website, LinkedIn, social links, and review platform links (Google Maps, Yelp, etc.).
                  4. Tech Stack: Clues about software they use (CRM, booking systems, helpdesks).

                  Use your "exa_search_and_contents" tool to browse their site and social profiles.
                  Provide a comprehensive research summary as text.`,
});

export async function researcherNode(state: typeof LeadState.State) {
  const { companyName, location } = state;

  const query = (location && location !== "Unknown") 
    ? `Research company "${companyName}" in/near "${location}"` 
    : `Research company "${companyName}" and find its primary location/headquarters.`;

  const result = await researchAgent.invoke({
    messages: [{ role: "user", content: query }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;

  const structuredLlm = llm.withStructuredOutput(businessProfileSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("You are a data editor. Extract the structured business profile from the following research report. Ensure all fields are populated; use 'Not found' instead of leaving blank."),
    { role: "user", content: finalAgentMessage }
  ]);

  return {
    businessProfile: finalStructured,
    messages: result.messages,
  };
}
