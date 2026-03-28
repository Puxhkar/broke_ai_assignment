import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface BusinessProfile {
  description: string;
  sizeSignals: string;
  digitalPresence: string;
  toolsUsed: string;
  refinedLocation?: string;
}

export interface ContactCard {
  phone?: string;
  phoneSourceLabel?: string;
  email?: string;
  emailSourceLabel?: string;
  whatsapp?: string;
  whatsappSourceLabel?: string;
  sourceUrl: string;
}

export const LeadState = Annotation.Root({
  companyName: Annotation<string>(),
  location: Annotation<string>(),
  discoveredLocation: Annotation<string | undefined>(),
  
  businessProfile: Annotation<BusinessProfile>(),
  contactCard: Annotation<ContactCard>(),
  outreachMessage: Annotation<string>(),
  outreachReasoning: Annotation<string>(),
  
  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});
