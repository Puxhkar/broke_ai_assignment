import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface BusinessProfile {
  description: string;
  sizeSignals: string;
  digitalPresence: string;
  toolsUsed: string;
  refinedLocation?: string;
  officialWebsite?: string;
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

const defaultBusinessProfile: BusinessProfile = {
  description: "Not found",
  sizeSignals: "Not found",
  digitalPresence: "Not found",
  toolsUsed: "Not found",
  refinedLocation: undefined,
  officialWebsite: "N/A",
};

const defaultContactCard: ContactCard = {
  phone: "Not found",
  phoneSourceLabel: "N/A",
  email: "Not publicly available",
  emailSourceLabel: "N/A",
  whatsapp: "Not found",
  whatsappSourceLabel: "N/A",
  sourceUrl: "N/A",
};

export const LeadState = Annotation.Root({
  companyName: Annotation<string>(),
  location: Annotation<string>(),

  discoveredLocation: Annotation<string | undefined>(),
  websiteUrl: Annotation<string | undefined>(),
  researchRetryCount: Annotation<number>({
    reducer: (x, y) => (y !== undefined ? x + y : x),
    default: () => 0,
  }),
  contactRetryCount: Annotation<number>({
    reducer: (x, y) => (y !== undefined ? x + y : x),
    default: () => 0,
  }),

  businessProfile: Annotation<BusinessProfile>({
    reducer: (_, update) => update ?? defaultBusinessProfile,
    default: () => defaultBusinessProfile,
  }),

  contactCard: Annotation<ContactCard>({
    reducer: (_, update) => update ?? defaultContactCard,
    default: () => defaultContactCard,
  }),

  outreachMessage: Annotation<string>(),
  outreachReasoning: Annotation<string>(),

  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => {
      if (!right) return left;
      return Array.isArray(right)
        ? left.concat(right)
        : left.concat([right]);
    },
    default: () => [],
  }),
});