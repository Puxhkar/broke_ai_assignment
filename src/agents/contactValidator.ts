import { LeadState } from "./state";

export async function contactValidatorNode(state: typeof LeadState.State) {
    const { contactCard, companyName } = state;

    const logs: string[] = [`[ContactValidator] Validating contact info for "${companyName}"...`];

    let isValid = true;

    const phone = contactCard.phone?.toLowerCase() || "";
    const email = contactCard.email?.toLowerCase() || "";

    if (
        (!phone || phone === "not found") &&
        (!email || email === "not publicly available")
    ) {
        logs.push("[ContactValidator] ❌ No usable contact info found.");
        isValid = false;
    }

    if (
        email.includes("example") ||
        email.includes("test") ||
        email.includes("noreply") ||
        email.includes("dummy")
    ) {
        logs.push("[ContactValidator] ❌ Invalid email detected.");
        isValid = false;
    }

    if (phone && phone.length < 8) {
        logs.push("[ContactValidator] ⚠️ Phone number seems too short.");
    }

    if (!contactCard.sourceUrl || contactCard.sourceUrl === "N/A") {
        logs.push("[ContactValidator] ⚠️ Missing source URL.");
    }

    if (isValid) {
        logs.push("[ContactValidator] ✅ Contact data validated.");
        return { logs };
    } else {
        logs.push("[ContactValidator] 🔁 Retrying contact discovery...");
        return { 
            logs,
            contactRetryCount: 1
        };
    }
}