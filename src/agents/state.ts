import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface BusinessProfile {
  description: string;
  sizeSignals: string;
  digitalPresence: string;
  toolsUsed: string;
}

export interface ContactCard {
  phone?: string;
  email?: string;
  whatsapp?: string;
  sourceUrl: string;
}

export const LeadState = Annotation.Root({
  companyName: Annotation<string>(),
  location: Annotation<string>(),
  
  businessProfile: Annotation<BusinessProfile>(),
  contactCard: Annotation<ContactCard>(),
  outreachMessage: Annotation<string>(),
  
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});
