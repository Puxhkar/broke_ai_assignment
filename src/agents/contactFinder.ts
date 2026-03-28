import { exaSearchTool } from "./tools/exa";
import { LeadState } from "./state";
import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { retryWithWait } from "../lib/retry";
import { llm } from "./llm";

const contactCardSchema = z.object({
  phone: z.string().default("Not found"),
  phoneSourceLabel: z.string().default("N/A"),
  email: z.string().default("Not publicly available"),
  emailSourceLabel: z.string().default("N/A"),
  whatsapp: z.string().default("Not found"),
  whatsappSourceLabel: z.string().default("N/A"),
  sourceUrl: z.string().default("N/A"),
});

export async function contactFinderNode(state: typeof LeadState.State) {
  const { companyName, location, discoveredLocation } = state;
  const officialSite = state.businessProfile.officialWebsite && state.businessProfile.officialWebsite !== "N/A" ? state.businessProfile.officialWebsite : null;
  const targetLocation = discoveredLocation || location;

  const initialLogs = [`[ContactFinder] Locating contact data for "${companyName}"...`];
  if (officialSite) {
    initialLogs.push(`[ContactFinder] Prioritizing official domain: ${officialSite}`);
  }

  const contactSystemPrompt = `You are an expert contact researcher.
Your goal is to find valid contact details for "${companyName}" in "${targetLocation}".

STRATEGY:
1. CHECK WEBSITE: If a website is provided (${officialSite}), check its contact page, footer, and header.
2. CHECK DIRECTORIES: Search Indian business directories like Justdial, Indiamart, Vykart, and Facebook for verified phone numbers and emails. This is CRITICAL if the official website is missing or broken.
3. VERIFY: Ensure the contact details belong to "${companyName}".

CRITICAL:
- Look for Phone numbers (starting with +91 if in India).
- Look for Emails (official company emails).
- Look for WhatsApp buttons or mentions.
- If you find an "Nginx" or "Fedora" related source, IGNORE it as it is likely a generic hosting page.

DO NOT return generic placeholders. If info is missing, say "Not found".`;

  const agent = createAgent({
    model: llm,
    tools: [exaSearchTool],
    systemPrompt: contactSystemPrompt,
  });

  const query = `Find contact information (Phone, Email, WhatsApp) for company "${companyName}" in "${targetLocation}". 
  Search official website (${officialSite || "search for one"}), LinkedIn, Facebook, Justdial, and Indiamart.`;

  const result = await retryWithWait(() => agent.invoke({
    messages: [new HumanMessage(query)]
  }));

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;
  const structuredLlm = llm.withStructuredOutput(contactCardSchema);

  const finalStructured = await retryWithWait(() => structuredLlm.invoke([
    new SystemMessage("Extract contact card from the research. If info is missing, use 'Not found' or 'N/A'."),
    { role: "user", content: finalAgentMessage }
  ]));

  const outputLogs = [
    `[ContactFinder] Contact search complete. Grounded in source: ${finalStructured.sourceUrl}`,
  ];

  return {
    contactCard: finalStructured,
    logs: [...initialLogs, ...outputLogs],
  };
}
