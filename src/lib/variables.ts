// Prompt variables (SPEC §5 M4): {{name}} placeholders, zero config.
// The scan page's inline script uses the same pattern (interpolated via
// VARIABLE_PATTERN) so server and client can never drift.

// Name must start with a non-space char; internal spaces are fine
// ({{first name}}), whitespace-only placeholders are not variables.
export const VARIABLE_PATTERN = "\\{\\{\\s*([^{}\\s][^{}\\n]{0,49}?)\\s*\\}\\}";

export function extractVariables(text: string): string[] {
    const re = new RegExp(VARIABLE_PATTERN, "g");
    const names: string[] = [];
    let match;
    while ((match = re.exec(text))) {
        if (!names.includes(match[1])) names.push(match[1]);
    }
    return names;
}

/** Replace filled variables; untouched ones keep their {{placeholder}}. */
export function fillVariables(template: string, values: Record<string, string>): string {
    return template.replace(new RegExp(VARIABLE_PATTERN, "g"), (all, name: string) =>
        values[name] ? values[name] : all
    );
}
