import { NextResponse } from "next/server";
import { leadProcessorApp } from "../../../agents/index";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { companyName, location } = await req.json();

  if (!companyName || !location) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log(`[Stream] Processing lead: ${companyName}`);
        
        // Use streamUpdates to get real-time node transitions
        const eventStream = await leadProcessorApp.stream(
          { companyName, location },
          { streamMode: "updates" }
        );

        for await (const update of eventStream) {
          // Send each update as a newline-delimited JSON chunk
          const chunk = encoder.encode(JSON.stringify(update) + "\n");
          controller.enqueue(chunk);
        }
        
        controller.close();
      } catch (error: unknown) {
        console.error("Stream Error:", error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        const errorChunk = encoder.encode(JSON.stringify({ error: msg }) + "\n");
        controller.enqueue(errorChunk);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
