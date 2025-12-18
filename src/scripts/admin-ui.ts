export function initAdminUI() {
    // Clean ok/err from URL after render
    const url = new URL(window.location.href);
    if (url.searchParams.has("ok") || url.searchParams.has("err")) {
        url.searchParams.delete("ok");
        url.searchParams.delete("err");
        window.history.replaceState({}, "", url.pathname + url.search);
    }

    // Prevent mousewheel changing number inputs
    document.addEventListener(
        "wheel",
        (e) => {
            const el = e.target;
            if (
                el instanceof HTMLInputElement &&
                el.type === "number" &&
                document.activeElement === el
            ) {
                el.blur();
            }
        },
        { passive: true }
    );

    // Confirm only when the clicked submit button has data-confirm
    document.addEventListener("submit", (e) => {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;

        const submitter = e.submitter;
        if (!(submitter instanceof HTMLElement)) return;

        const msg = submitter.getAttribute("data-confirm");
        if (!msg) return;

        if (!confirm(msg)) e.preventDefault();
    });
}
