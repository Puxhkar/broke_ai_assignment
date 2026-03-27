import { StateGraph, START, END } from "@langchain/langgraph";
import { LeadState } from "./state";
import { researcherNode } from "./researcher";
import { contactFinderNode } from "./contactFinder";
import { outreachWriterNode } from "./outreachWriter";

const workflow = new StateGraph(LeadState)
  .addNode("researcher", researcherNode)
  .addNode("contactFinder", contactFinderNode)
  .addNode("outreachWriter", outreachWriterNode)

  .addEdge(START, "researcher")
  .addEdge("researcher", "contactFinder")
  .addEdge("contactFinder", "outreachWriter")
  .addEdge("outreachWriter", END);


export const leadProcessorApp = workflow.compile();
