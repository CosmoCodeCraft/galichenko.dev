type ThemePreference = "system" | "light" | "dark";
type FontPreference = "plex" | "system";
type DarkPreference = "graphite" | "navy";
type HeroVisualPreference = "calm" | "live" | "alert";
const controls = document.querySelectorAll<HTMLButtonElement>(
  "[data-theme-control]",
);
const fontControls = document.querySelectorAll<HTMLButtonElement>(
  "[data-design-font-option]",
);
const darkControls = document.querySelectorAll<HTMLButtonElement>(
  "[data-design-dark-option]",
);
const heroVisualControls = document.querySelectorAll<HTMLButtonElement>(
  "[data-hero-visual-option]",
);
let preference: ThemePreference = "system";
let fontPreference: FontPreference =
  document.documentElement.dataset.designFont === "system" ? "system" : "plex";
let darkPreference: DarkPreference =
  document.documentElement.dataset.designDark === "navy" ? "navy" : "graphite";
let heroVisualPreference: HeroVisualPreference =
  document.documentElement.dataset.heroVisual === "calm" ||
  document.documentElement.dataset.heroVisual === "alert"
    ? document.documentElement.dataset.heroVisual
    : "live";
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
function applyDesignComparison() {
  document.documentElement.dataset.designFont = fontPreference;
  document.documentElement.dataset.designDark = darkPreference;
  fontControls.forEach((control) => {
    control.ariaPressed = String(
      control.dataset.designFontOption === fontPreference,
    );
  });
  darkControls.forEach((control) => {
    control.ariaPressed = String(
      control.dataset.designDarkOption === darkPreference,
    );
  });
  document.documentElement.dataset.heroVisual = heroVisualPreference;
  heroVisualControls.forEach((control) => {
    control.ariaPressed = String(
      control.dataset.heroVisualOption === heroVisualPreference,
    );
  });
}
applyTheme();
applyDesignComparison();
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
fontControls.forEach((control) =>
  control.addEventListener("click", () => {
    fontPreference =
      control.dataset.designFontOption === "system" ? "system" : "plex";
    try {
      localStorage.setItem("sg-design-font", fontPreference);
    } catch {
      /* Preference still works for this page. */
    }
    applyDesignComparison();
  }),
);
darkControls.forEach((control) =>
  control.addEventListener("click", () => {
    darkPreference =
      control.dataset.designDarkOption === "navy" ? "navy" : "graphite";
    try {
      localStorage.setItem("sg-design-dark", darkPreference);
    } catch {
      /* Preference still works for this page. */
    }
    applyDesignComparison();
  }),
);
heroVisualControls.forEach((control) =>
  control.addEventListener("click", () => {
    const selected = control.dataset.heroVisualOption;
    heroVisualPreference =
      selected === "calm" || selected === "alert" ? selected : "live";
    try {
      localStorage.setItem("sg-hero-visual", heroVisualPreference);
    } catch {
      /* Preference still works for this page. */
    }
    applyDesignComparison();
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
