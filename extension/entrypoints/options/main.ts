import { DEFAULT_API_BASE, getSettings, saveSettings } from "../../utils/settings";

const baseEl = document.getElementById("api-base") as HTMLInputElement;
const tokenEl = document.getElementById("api-token") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

function setStatus(text: string, ok: boolean | null = null) {
    statusEl.textContent = text;
    statusEl.className = ok === null ? "" : ok ? "ok" : "bad";
}

async function load() {
    const settings = await getSettings();
    baseEl.value = settings.apiBase;
    tokenEl.value = settings.apiToken ?? "";
    baseEl.placeholder = DEFAULT_API_BASE;
}

async function save() {
    await saveSettings({
        apiBase: (baseEl.value.trim() || DEFAULT_API_BASE).replace(/\/$/, ""),
        apiToken: tokenEl.value.trim() || null,
    });
    setStatus("Saved ✓", true);
    setTimeout(() => setStatus(""), 2000);
}

async function test() {
    setStatus("Testing…");
    await save();
    const { apiBase, apiToken } = await getSettings();
    try {
        const res = await fetch(`${apiBase}/api/prompts?limit=1`, {
            credentials: "include",
            headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
        });
        if (res.ok) {
            setStatus("Connected — library access works ✓", true);
        } else if (res.status === 401) {
            setStatus("Server reachable, but not signed in — check the token", false);
        } else {
            setStatus(`Server responded with ${res.status}`, false);
        }
    } catch {
        setStatus("Can't reach that server — check the URL", false);
    }
}

document.getElementById("save")!.addEventListener("click", save);
document.getElementById("test")!.addEventListener("click", test);
void load();
