import Exa from 'exa-js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const apiKey = process.env.EXA_API_KEY;
export const exa = new Exa(apiKey);

export const exaSearchTool = tool(
  async ({ query, type = "auto", category, includeDomains, excludeDomains, numResults = 5 }) => {
    try {
      const result = await exa.searchAndContents(query, {
        type: type as "auto" | "fast" | "deep" | "deep-reasoning",
        category: category as "company" | "people" | "news" | "research paper",
        includeDomains,
        excludeDomains,
        numResults,
        text: { maxCharacters: 10000 },
        highlights: { maxCharacters: 2000 },
      });
      return JSON.stringify(result.results);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return `Error searching: ${errorMessage}`;
    }
  },
  {
    name: "exa_search_and_contents",
    description: "Advanced web search using Exa. Use categories like 'company' for business research or 'people' for contact info.",
    schema: z.object({
      query: z.string().describe("The search query."),
      type: z.enum(["auto", "fast", "deep", "deep-reasoning"]).optional().default("auto").describe("Search depth/type."),
      category: z.enum(["company", "people", "news", "research paper"]).optional().describe("Search category."),
      includeDomains: z.array(z.string()).optional().describe("Domains to include."),
      excludeDomains: z.array(z.string()).optional().describe("Domains to exclude."),
      numResults: z.number().optional().default(5).describe("Number of results to return."),
    }),
  }
);
