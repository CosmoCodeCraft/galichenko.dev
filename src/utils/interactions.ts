import { initHeroSystem } from "./hero-system";

type ThemePreference = "system" | "light" | "dark";
const controls = document.querySelectorAll<HTMLButtonElement>(
  "[data-theme-control]",
);
let preference: ThemePreference = "system";
try {
  const saved = localStorage.getItem("sg-theme");
  if (saved === "light" || saved === "dark") preference = saved;
} catch {
  /* Keep system preference. */
}
function applyTheme() {
  if (preference === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
  controls.forEach((control) => {
    const label = control.dataset[`${preference}Label`];
    const description = `${control.dataset.labelPrefix}: ${label}`;
    control.dataset.themePreference = preference;
    control.ariaLabel = description;
    control.title = description;
    const text = control.querySelector<HTMLElement>(".theme-label");
    if (text)
      text.textContent = `${control.dataset.compactLabelPrefix}: ${label}`;
  });
}
applyTheme();
initHeroSystem();
const homeMain = document.querySelector(".home-main");
const navigationEntry = performance.getEntriesByType(
  "navigation",
)[0] as PerformanceNavigationTiming | undefined;
if (homeMain && navigationEntry?.type === "reload") {
  if (location.hash === "#projects")
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  window.addEventListener(
    "pageshow",
    () => {
      const resetScroll = () => window.scrollTo({ top: 0, behavior: "auto" });
      resetScroll();
      requestAnimationFrame(resetScroll);
    },
    { once: true },
  );
}
const selectedWork = document.querySelector<HTMLAnchorElement>(
  '.scroll-hint[href="#projects"]',
);
selectedWork?.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const target = document.querySelector<HTMLElement>(".home-projects");
  if (!target) return;
  event.preventDefault();
  const headerHeight =
    document.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect()
      .height ?? 0;
  const desired =
    window.scrollY + target.getBoundingClientRect().top - headerHeight + 14;
  const maximum = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  window.scrollTo({
    top: Math.min(maximum, Math.max(0, desired)),
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});
document
  .querySelectorAll<HTMLElement>("[data-enhanced]")
  .forEach((el) => (el.hidden = false));
controls.forEach((control) =>
  control.addEventListener("click", () => {
    preference =
      preference === "system"
        ? "light"
        : preference === "light"
          ? "dark"
          : "system";
    try {
      if (preference === "system") localStorage.removeItem("sg-theme");
      else localStorage.setItem("sg-theme", preference);
    } catch {
      /* Preference still works for this page. */
    }
    applyTheme();
  }),
);
const projectToc = document.querySelector<HTMLElement>("[data-project-toc]");
if (projectToc && "IntersectionObserver" in window) {
  const links = Array.from(
    projectToc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
  );
  const tracked = links
    .map((link) => {
      const id = decodeURIComponent(link.hash.slice(1));
      const heading = document.getElementById(id);
      return heading instanceof HTMLHeadingElement && heading.tagName === "H2"
        ? { heading, link }
        : undefined;
    })
    .filter((item) => item !== undefined);

  if (tracked.length > 0) {
    const setCurrent = (active: HTMLAnchorElement) => {
      links.forEach((link) => {
        if (link === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };
    const headerOffset =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--header-height",
        ),
      ) + 40;
    const observer = new IntersectionObserver(
      () => {
        const active =
          tracked.findLast(
            ({ heading }) =>
              heading.getBoundingClientRect().top <= headerOffset,
          ) ?? tracked[0];
        setCurrent(active.link);
      },
      {
        rootMargin: `-${headerOffset}px 0px -65% 0px`,
        threshold: 0,
      },
    );
    tracked.forEach(({ heading }) => observer.observe(heading));
    setCurrent(tracked[0].link);
  }
}

const menu = document.querySelector<HTMLDetailsElement>(".mobile-menu");
function closeMenu(restore = false) {
  if (!menu?.open) return;
  menu.open = false;
  if (restore) menu.querySelector("summary")?.focus();
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (event.target instanceof Node && !menu?.contains(event.target))
    closeMenu();
});
menu
  ?.querySelectorAll("a")
  .forEach((a) => a.addEventListener("click", () => closeMenu()));
menu?.addEventListener("focusout", () => {
  setTimeout(() => {
    if (!menu.contains(document.activeElement)) closeMenu();
  }, 0);
});
matchMedia("(min-width: 64rem)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});
const copy = document.querySelector<HTMLButtonElement>("[data-copy-email]");
copy?.addEventListener("click", async () => {
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  if (!status) return;
  try {
    await navigator.clipboard.writeText(copy.dataset.copyEmail ?? "");
    status.textContent = copy.dataset.success ?? "";
  } catch {
    status.textContent = copy.dataset.failure ?? "";
  }
});
