type Kind = "ok" | "err";

function show(statusEl: HTMLElement, kind: Kind, msg: string) {
    statusEl.textContent = msg;
    statusEl.classList.remove("status--empty", "status--success", "status--error");
    statusEl.classList.add(kind === "ok" ? "status--success" : "status--error");
    (statusEl as HTMLElement).focus?.();
}

export function initPhotosSubmit() {
    const statusEl = document.getElementById("status");
    if (!statusEl) return;

    const url = new URL(window.location.href);
    const err = url.searchParams.get("err");
    const submitted = url.searchParams.get("submitted");

    if (submitted === "1") {
        show(statusEl, "ok", "Thanks! Your photo was submitted for review.");
        url.searchParams.delete("submitted");
        window.history.replaceState({}, "", url.pathname + url.search);
        return;
    }

    if (err) {
        const msg =
            err === "file" ? "Please choose a file."
                : err === "category" ? "Please choose a valid category."
                    : err === "alt" ? "Alt text must be at least 5 characters."
                        : err === "type" ? "Please upload a JPG, PNG, WEBP, or GIF."
                            : err === "size" ? "File must be under 8MB."
                                : "Sorry, something went wrong. Please try again.";

        show(statusEl, "err", msg);
        url.searchParams.delete("err");
        window.history.replaceState({}, "", url.pathname + url.search);
    }
}

export function initFilePickerUI() {
    const input = document.querySelector<HTMLInputElement>('#photo');
    const btn = document.querySelector<HTMLButtonElement>('[data-file-btn]');
    const name = document.querySelector<HTMLElement>('[data-file-name]');
    if (!input || !btn || !name) return;

    btn.addEventListener('click', () => {
        // Chrome has showPicker; fallback for others
        (input as any).showPicker?.();
        input.click();
    });

    input.addEventListener('change', () => {
        const f = input.files?.[0];
        name.textContent = f ? f.name : 'No file chosen';
    });
}
