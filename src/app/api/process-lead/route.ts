import { NextResponse } from "next/server";
import { leadProcessorApp } from "../../../agents/index";

export async function POST(req: Request) {
  try {
    const { companyName, location } = await req.json();

    if (!companyName || !location) {
      return NextResponse.json(
        { error: "Company name and location are required." },
        { status: 400 }
      );
    }

    console.log(`Processing lead: ${companyName} located in ${location}`);

    const finalState = await leadProcessorApp.invoke({
      companyName,
      location,
    });

    return NextResponse.json({
      businessProfile: finalState.businessProfile,
      contactCard: finalState.contactCard,
      outreachMessage: finalState.outreachMessage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to process lead.";
    console.error("Error processing lead:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
