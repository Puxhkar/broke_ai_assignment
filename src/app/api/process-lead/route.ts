import { NextResponse } from "next/server";
import { leadProcessorApp } from "../../../agents/index";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { companyName, location } = await req.json();

    if (!companyName || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log(`[Stream] Processing lead: ${companyName}`);
          
          const eventStream = await leadProcessorApp.stream(
            { companyName, location },
            { streamMode: "updates" }
          );

          for await (const update of eventStream) {
            const chunk = encoder.encode(JSON.stringify(update) + "\n");
            controller.enqueue(chunk);
          }
          
          controller.close();
        } catch (error: unknown) {
          console.error("Stream Error:", error);
          const msg = error instanceof Error ? error.message : "Stream error";
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
