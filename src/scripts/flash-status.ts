type FlashMap = Record<string, string>;

function setStatus(el: HTMLElement, kind: "ok" | "err", msg: string) {
    el.textContent = msg;
    el.classList.remove("status--empty", "status--success", "status--error");
    el.classList.add(kind === "ok" ? "status--success" : "status--error");
    el.focus?.();
}

export function initFlashStatus(opts: {
    elId?: string;
    okParam?: string;          // e.g. "sent" or "ok"
    errParam?: string;         // e.g. "err"
    okMessages?: FlashMap;     // e.g. { "1": "..." }
    errMessages?: FlashMap;    // e.g. { "captcha": "...", "server": "..." }
    defaultErr?: string;
    cleanupDelayMs?: number;   // optional paint delay
}) {
    const {
        elId = "status",
        okParam = "ok",
        errParam = "err",
        okMessages = {},
        errMessages = {},
        defaultErr = "Sorry, something went wrong. Please try again.",
        cleanupDelayMs = 0,
    } = opts;

    const el = document.getElementById(elId);
    if (!el) return;

    const url = new URL(window.location.href);
    const ok = url.searchParams.get(okParam);
    const err = url.searchParams.get(errParam);

    if (!ok && !err) return;

    if (ok && okMessages[ok]) setStatus(el, "ok", okMessages[ok]);
    else if (err) setStatus(el, "err", errMessages[err] ?? defaultErr);

    const cleanup = () => {
        url.searchParams.delete(okParam);
        url.searchParams.delete(errParam);
        window.history.replaceState({}, "", url.pathname + url.search);
    };

    if (cleanupDelayMs > 0) window.setTimeout(cleanup, cleanupDelayMs);
    else cleanup();
}
