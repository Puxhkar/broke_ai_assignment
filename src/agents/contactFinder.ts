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
  systemPrompt: `You are an expert contact researcher.
Your task is to locate valid contact details for the provided business.

                  PRO TIPS FOR ACCURACY:
                  1. Use type: "auto" for quick lookups or type: "deep" for hard-to-find contacts.
                  2. Targeted Search: Search for "[Company] contact information", "[Company] customer support phone", or "[Company] sales email".
                  3. Check Directories: Search for the company on LinkedIn, IndiaMART, Justdial, Yelp, or ZoomInfo.

                  Prioritize finding:
                  - Direct Phone Number
                  - Professional Email
                  - WhatsApp contact (especially common for Indian SMBs)

Provide your findings in a clear text summary and explicitly include the Source URL.`,
});

export async function contactFinderNode(state: typeof LeadState.State) {
  const { businessProfile } = state;

  const result = await contactAgent.invoke({
    messages: [{
      role: "user",
      content: `Find contact info and direct links for this business: ${JSON.stringify(businessProfile)}`
    }]
  });

  const finalAgentMessage = result.messages[result.messages.length - 1].content as string;

  const structuredLlm = llm.withStructuredOutput(contactCardSchema);

  const finalStructured = await structuredLlm.invoke([
    new SystemMessage("Extract the contact card from the research data. Ensure 'sourceUrl' is the most relevant contact or company page. For missing fields, use empty strings."),
    { role: "user", content: finalAgentMessage }
  ]);

  return {
    contactCard: finalStructured,
    messages: result.messages,
  };
}
