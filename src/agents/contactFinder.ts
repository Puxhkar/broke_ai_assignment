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

const contactCardSchema = z.object({
  phone: z.string().default("Not found"),
  phoneSourceLabel: z.string().default("N/A"),
  email: z.string().default("Not publicly available"),
  emailSourceLabel: z.string().default("N/A"),
  whatsapp: z.string().default("Not found"),
  whatsappSourceLabel: z.string().default("N/A"),
  sourceUrl: z.string().default("N/A"),
});

const contactAgent = createAgent({
  model: llm,
  tools: [exaSearchTool],
  systemPrompt: `Expert contact researcher. 
Find Phone, Email, and WhatsApp. For each, identify a clear source label (e.g. "Found via company website", "Found via Justdial").`,
});

export async function contactFinderNode(state: typeof LeadState.State) {
  const { companyName, discoveredLocation, location } = state;
  const targetLocation = discoveredLocation || location;

  const initialLogs = [`[ContactFinder] Locating contact data for "${companyName}" in "${targetLocation}"...`];

  const result = await contactAgent.invoke({
    messages: [{
      role: "user",
      content: `Find contact info and specific source reasons for "${companyName}" in "${targetLocation}".`
    }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;
  const structuredLlm = llm.withStructuredOutput(contactCardSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("Extract contact card. Ensure labels like 'Found via company website' are specific. Use 'Not found'/'N/A' for missing fields."),
    { role: "user", content: finalAgentMessage }
  ]);

  const outputLogs = [
    `[ContactFinder] Contact search complete. Grounded in source: ${finalStructured.sourceUrl}`,
  ];

  return {
    contactCard: finalStructured,
    logs: [...initialLogs, ...outputLogs],
    messages: result.messages,
  };
}
