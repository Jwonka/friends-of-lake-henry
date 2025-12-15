export function initContactStatus(): void {
    const el = document.getElementById("status");
    if (!(el instanceof HTMLElement)) return;

    const statusEl = el; // re-bind so nested show() keeps narrowing

    const url = new URL(window.location.href);
    const sent = url.searchParams.get("sent");
    const err = url.searchParams.get("err");

    function show(kind: "ok" | "err", msg: string) {
        statusEl.textContent = msg;
        statusEl.classList.remove("status--empty", "status--success", "status--error");
        statusEl.classList.add(kind === "ok" ? "status--success" : "status--error");
        statusEl.focus();
    }

    if (sent === "1") {
        show("ok", "Thanks! We’ll be in touch shortly.");
        url.searchParams.delete("sent");
        window.history.replaceState({}, "", url.pathname + url.search);
        return;
    }

    if (err) {
        show(
            "err",
            err === "captcha"
                ? "Verification failed. Please try again."
                : err === "input"
                    ? "Please check your details and try again."
                    : "Sorry, something went wrong. Please try again."
        );
        url.searchParams.delete("err");
        window.history.replaceState({}, "", url.pathname + url.search);
    }
}
