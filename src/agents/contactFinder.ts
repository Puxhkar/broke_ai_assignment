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
  phone: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  sourceUrl: z.string(),
});

const contactAgent = createAgent({
  model: llm,
  tools: [exaSearchTool],
  systemPrompt: `You are an expert contact researcher specialized in finding B2B and direct contact info.
                  Your task is to locate valid contact details for the provided business profile.

                  Search strategies:
                  1. Examine the 'Contact' or 'About' page of the main website.
                  2. Search public directories like IndiaMART, Justdial, Yelp, or LinkedIn public company pages.
                  3. Look for Google Business Profile snippets or other marketplace listings.

                  Prioritize finding:
                  - Direct Phone Number
                  - Professional Email
                  - WhatsApp contact (especially common for Indian SMBs)

                  Provide your findings in a clear text summary and explicitly include the Source URL where the data was verified.`,
});

export async function contactFinderNode(state: typeof LeadState.State) {
  const { businessProfile } = state;

  const result = await contactAgent.invoke({
    messages: [{
      role: "user",
      content: `Please find contact info for this business: ${JSON.stringify(businessProfile)}`
    }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;

  const structuredLlm = llm.withStructuredOutput(contactCardSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("Extract the contact card from the research data. Ensure 'sourceUrl' is populated with the best link found. For missing fields, use empty strings."),
    { role: "user", content: finalAgentMessage }
  ]);

  return {
    contactCard: finalStructured,
    messages: result.messages,
  };
}
