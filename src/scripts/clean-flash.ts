export function cleanFlashParams(keys: string[], delayMs = 250) {
    const params = new URLSearchParams(window.location.search);
    if (!keys.some((k) => params.has(k))) return;

    window.setTimeout(() => {
        for (const k of keys) params.delete(k);
        const qs = params.toString();
        const next = window.location.pathname + (qs ? `?${qs}` : "");
        window.history.replaceState({}, "", next);
    }, delayMs);
}