type ThemePreference = "system" | "light" | "dark";
const controls = document.querySelectorAll<HTMLButtonElement>(
  "[data-theme-control]",
);
let preference: ThemePreference = "system";
try {
  const saved = localStorage.getItem("sg-theme");
  if (saved === "light" || saved === "dark" || saved === "system")
    preference = saved;
} catch {
  /* Keep system preference. */
}
function apply() {
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
apply();
document
  .querySelectorAll<HTMLElement>("[data-enhanced]")
  .forEach((el) => (el.hidden = false));
controls.forEach((control) =>
  control.addEventListener("click", () => {
    const order: ThemePreference[] = ["system", "light", "dark"];
    preference = order[(order.indexOf(preference) + 1) % order.length];
    try {
      localStorage.setItem("sg-theme", preference);
    } catch {
      /* Preference still works for this page. */
    }
    apply();
  }),
);
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
