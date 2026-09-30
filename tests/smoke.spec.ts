import { test, expect } from "@playwright/test";
const sizes = [
  [1920, 1080],
  [1440, 900],
  [1280, 800],
  [900, 900],
  [390, 844],
  [320, 740],
];
for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of sizes) {
    test(`${width} × ${height} / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await expect(page.locator(".project-card")).toHaveCount(3);
      await expect(page.locator(".hero-visual")).toBeVisible({
        visible: width > 672,
      });
      expect(
        await page
          .locator("#projects")
          .evaluate((section) =>
            Math.round(section.getBoundingClientRect().top),
          ),
      ).toBeGreaterThanOrEqual(height);
      const positions = await page
        .locator(".project-card")
        .evaluateAll((cards) =>
          cards.map((card) =>
            [...card.children].map((el) => ({
              top: el.getBoundingClientRect().top,
              left: el.getBoundingClientRect().left,
            })),
          ),
        );
      for (let i = 1; i < positions.length; i++)
        if (Math.abs(positions[i][0].top - positions[i - 1][0].top) < 1)
          for (let j = 0; j < 5; j++)
            expect(
              Math.abs(positions[i][j].top - positions[i - 1][j].top),
            ).toBeLessThan(1);
      const columns = await page
        .locator(".projects-grid")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        );
      expect(columns).toBe(width >= 1280 ? 3 : width === 900 ? 2 : 1);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `docs/screenshots/${width}x${height}-${theme}.png`,
          fullPage: true,
        });
    });
  }
}
test("Theme persistence, system changes, menu and keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.locator(".mobile-menu summary").click();
  await expect(page.locator(".drawer")).toBeVisible();
  const theme = page.locator(".drawer [data-theme-control]");
  await expect(theme).toHaveAttribute("data-theme-preference", "system");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(theme).toHaveAttribute("data-theme-preference", "light");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator(".mobile-menu summary").click();
  await page.locator(".drawer [data-theme-control]").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 26, 39)",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(240, 244, 248)",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".mobile-menu summary")).toBeFocused();
  await expect(page.locator(".drawer")).not.toBeVisible();
  await page.locator('a[href="#projects"]').click();
  const top = await page
    .locator("#projects")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(66);
});
test("Clipboard success and failure", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.locator("[data-copy-email]").click();
  await expect(page.locator("[data-copy-status]")).toHaveText("Email copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "sagalichenko@edu.hse.ru",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new Error("Denied");
      },
    }),
  );
  await page.locator("[data-copy-email]").click();
  await expect(page.locator("[data-copy-status]")).toHaveText(
    "Select and copy the email above.",
  );
});
test("Routes and no-JS content", async ({ browser, page }) => {
  await page.goto("/");
  const links = await page
    .locator('a[href^="/"]')
    .evaluateAll((els) => [
      ...new Set(els.map((a) => a.getAttribute("href")!)),
    ]);
  for (const link of links) {
    const response = await page.request.get(link);
    expect(response.status(), link).toBe(200);
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
    colorScheme: "dark",
  });
  const nojs = await context.newPage();
  await nojs.goto("/");
  await expect(nojs.locator("h1")).toContainText("Sergey");
  await expect(nojs.locator(".project-card")).toHaveCount(3);
  await expect(nojs.locator("[data-copy-email]")).toBeHidden();
  await nojs.locator("summary").click();
  await expect(nojs.locator(".drawer a").first()).toBeVisible();
  await expect(nojs.locator("body")).toHaveCSS(
    "background-color",
    "rgb(17, 26, 39)",
  );
  await context.close();
});
