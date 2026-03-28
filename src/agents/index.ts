import { StateGraph, START, END } from "@langchain/langgraph";
import { LeadState } from "./state";
import { researcherNode } from "./researcher";
import { contactFinderNode } from "./contactFinder";
import { outreachWriterNode } from "./outreachWriter";
import { validatorNode } from "./validator";
import { contactValidatorNode } from "./contactValidator";

const MAX_RETRIES = 2;

const workflow = new StateGraph(LeadState)
  .addNode("researcher", researcherNode)
  .addNode("validator", validatorNode)
  .addNode("contactFinder", contactFinderNode)
  .addNode("contactValidator", contactValidatorNode)
  .addNode("outreachWriter", outreachWriterNode)

  .addEdge(START, "researcher")
  .addEdge("researcher", "validator")

  .addConditionalEdges("validator", (state) => {
    const retryCount = state.researchRetryCount || 0;
    if ((!state.websiteUrl || state.websiteUrl === "N/A") && retryCount < MAX_RETRIES) {
      return "researcher";
    }
    return "contactFinder";
  })

  .addEdge("contactFinder", "contactValidator")

  .addConditionalEdges("contactValidator", (state) => {
    const retryCount = state.contactRetryCount || 0;
    if ((!state.contactCard?.phone && !state.contactCard?.email) && retryCount < MAX_RETRIES) {
      return "contactFinder";
    }
    return "outreachWriter";
  })

  .addEdge("outreachWriter", END);

export const leadProcessorApp = workflow.compile();