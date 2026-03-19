import Exa from "exa-js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

let _exa: Exa | null = null;

function getExa() {
  if (!_exa) {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY is not set in environment.");
    }
    _exa = new Exa(apiKey);
  }
  return _exa;
}


export const exaSearchTool = tool(
  async ({
    query,
    type = "auto",
    numResults = 5,
  }) => {
    try {
      const exa = getExa();

      const result = await exa.search(query, {
        type: type as "auto" | "fast" | "deep" | "deep-reasoning",

        numResults: Math.min(numResults, 5), // Reduced from 8 to 5

        contents: {
          highlights: { numSentences: 1 }, // Only 1 highlight sentence
          text: { maxCharacters: 500 }, // Reduced from 1000 to 500
          maxAgeHours: 72,
        },
      });

      const cleanedResults = result.results.map((r) => ({
        title: r.title,
        url: r.url,
        highlights: r.highlights?.[0] || "",
        text: r.text ? r.text.substring(0, 400) + "..." : "",
      }));


      return JSON.stringify(cleanedResults, null, 2);
    } 
    catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);

      return JSON.stringify({
        error: true,
        message: `Exa search failed: ${errorMessage}`,
      });
    }
  },
  {
    name: "exa_search_and_contents",
    description: `
        Advanced web search tool using Exa.

        Best for:
        - Finding official company websites
        - Extracting business info
        - Contact discovery

        Guidelines:
        - Use specific queries (company + location)
        - Prefer official sources
        - Use multiple searches if needed
    `,
    schema: z.object({
      query: z.string(),

      type: z
        .enum(["auto", "fast", "deep", "deep-reasoning"])
        .optional()
        .default("auto"),

      numResults: z.number().optional().default(10),
    }),
  }
);