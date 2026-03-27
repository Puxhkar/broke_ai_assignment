import { ChatGoogle } from "@langchain/google";
import { LeadState } from "./state";
import { createAgent } from "langchain";

const llm = new ChatGoogle({
  model: "gemini-2.5-flash",
  temperature: 0.7,
});

const outreachAgent = createAgent({
  model: llm,
  systemPrompt: `You are a top-tier sales outreach writer working for Brokai Labs.
                  Brokai Labs builds AI systems: voice receptionists, SaaS platforms, and automation tools for SMBs.

                  Draft a highly personalized, short, outcome-first outreach message (WhatsApp style, not a formal email).
                  Use the business's profile to make it highly relevant to them. 
                  Mention the contact's company name. DO NOT use placeholders like [Name]. If you don't know the person's name, start with a friendly greeting instead. Include a low-friction call to action.`
});

export async function outreachWriterNode(state: typeof LeadState.State) {
  const { companyName, businessProfile, contactCard } = state;

  const result = await outreachAgent.invoke({
    messages: [{
      role: "user",
      content: `Company: ${companyName}
        Profile: ${JSON.stringify(businessProfile)}
        Contact Info Available: ${JSON.stringify(contactCard)}

        Generate the outreach message.`
    }]
  });

  return {
    outreachMessage: result.messages[result.messages.length - 1].content as string,
    messages: result.messages,
  };
}

