export function initPhotoFilters() {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".filter"));
    const items = Array.from(document.querySelectorAll<HTMLElement>(".photoLink"));
    if (buttons.length === 0 || items.length === 0) return;
    const statusEl = document.getElementById("filterStatus");
    const panel = document.querySelector<HTMLElement>('[role="tabpanel"]');

    function setActiveTab(activeBtn: HTMLButtonElement) {
        buttons.forEach((b) => {
            const isActive = b === activeBtn;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-selected", String(isActive));
            b.tabIndex = isActive ? 0 : -1;
        });

        panel?.setAttribute("aria-labelledby", activeBtn.id);
    }

    function applyFilter(filter: string) {
        let visible = 0;

        items.forEach((item) => {
            const category = (item.dataset.category ?? "").trim().toLowerCase();
            const target = filter.trim().toLowerCase();
            const match = target === "all" || category === target;
            item.style.display = match ? "" : "none";
            if (match) visible += 1;
        });

        if (statusEl) {
            statusEl.textContent = `Showing ${visible} photo${visible === 1 ? "" : "s"} in ${filter}.`;
        }
    }

    function activate(btn: HTMLButtonElement) {
        const filter = btn.dataset.filter ?? "All";
        setActiveTab(btn);
        applyFilter(filter);
        btn.focus();
    }

    if (buttons[0]) activate(buttons[0]);

    buttons.forEach((btn) => {
        btn.addEventListener("click", () => activate(btn));

        btn.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();

            const idx = buttons.indexOf(btn);
            const dir = e.key === "ArrowRight" ? 1 : -1;
            const next = buttons[(idx + dir + buttons.length) % buttons.length];
            if (next) activate(next);
        });
    });
}
