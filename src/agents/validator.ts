import { LeadState } from "./state";

export async function validatorNode(state: typeof LeadState.State) {
    const { companyName, businessProfile, websiteUrl} = state;

    const logs: string[] = [`[Validator] Validating research output for "${companyName}"...`];

    let isValid = true;
    const hasWebsite = websiteUrl && websiteUrl !== "N/A" && websiteUrl !== "Not found";
    const hasDescription = businessProfile.description && 
                           !businessProfile.description.toLowerCase().includes("not found") && 
                           businessProfile.description.length > 30;

    // Critical check: Do we have ANYTHING useful?
    if (!hasWebsite && !hasDescription) {
        logs.push("[Validator] ❌ No valid website or description found.");
        isValid = false;
    }

    if (hasDescription && (
        businessProfile.description.toLowerCase().includes("nginx") || 
        businessProfile.description.toLowerCase().includes("fedora") ||
        businessProfile.description.toLowerCase().includes("test page")
    )) {
        logs.push("[Validator] ❌ Placeholder content detected in description.");
        isValid = false;
    }

    if (isValid) {
        logs.push("[Validator] ✅ Research data validated successfully.");
        return { logs };
    } else {
        logs.push("[Validator] 🔁 Triggering re-research...");
        return { 
            logs,
            researchRetryCount: 1 // Increment reducer handles this
        };
    }
}