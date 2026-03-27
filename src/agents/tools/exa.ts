import Exa from 'exa-js';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';


const apiKey = process.env.EXA_API_KEY || 'AIza-not-a-real-key-but-avoids-constructor-error';
export const exa = new Exa(apiKey);

export const exaSearchTool = tool(
  async ({ query }) => {
    try {
      const result = await exa.searchAndContents(query, {
        type: "auto",
        numResults: 3,
        text: true,
        highlights: true,
      });
      return JSON.stringify(result.results);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return `Error searching: ${errorMessage}`;
    }
  },
  {
    name: "exa_search_and_contents",
    description: "Search the web for a query and retrieve the contents of the top results. Useful for researching a company.",
    schema: z.object({
      query: z.string().describe("The search query (e.g., 'Acme Corp Chicago' or 'Acme Corp Chicago website')"),
    }),
  }
);
