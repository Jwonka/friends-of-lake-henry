export function initNavToggle(): void {
    const btn = document.querySelector<HTMLButtonElement>(".menuBtn");
    const navEl = document.querySelector<HTMLElement>("#siteNav");

    if (!btn || !navEl) return;

    // Re-bind to non-null locals so closures keep the narrowing
    const menuBtn = btn;
    const nav = navEl;
    if (menuBtn.dataset.navInit === "true") return;
    menuBtn.dataset.navInit = "true";

    function setOpen(nextOpen: boolean) {
        nav.setAttribute("data-open", String(nextOpen));
        menuBtn.setAttribute("aria-expanded", String(nextOpen));
        if (!nextOpen) menuBtn.focus();
    }

    menuBtn.addEventListener("click", () => {
        const open = nav.getAttribute("data-open") === "true";
        setOpen(!open);
    });

    nav.addEventListener("click", (e: MouseEvent) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("a");
        if (!link) return;
        setOpen(false);
    });

    document.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        const open = nav.getAttribute("data-open") === "true";
        if (open) setOpen(false);
    });

    document.addEventListener("click", (e: MouseEvent) => {
        const open = nav.getAttribute("data-open") === "true";
        if (!open) return;

        const target = e.target;
        if (!(target instanceof Node)) return;

        const clickedInside = nav.contains(target) || menuBtn.contains(target);
        if (!clickedInside) setOpen(false);
    });
}