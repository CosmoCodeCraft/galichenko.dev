import { test, expect } from "@playwright/test";

const tags = ["DevOps", "Systems integration", "Kubernetes", "Observability"];

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1280, 1440]) {
    test(`SIRD presentation: ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const route of ["/", "/projects/"]) {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        const card = page.locator('[aria-labelledby$="project-sird"]');
        await expect(card.locator(".metadata > span").first()).toHaveText(
          "Completed",
        );
        await expect(card.locator(".tags li")).toHaveText(tags);
        if (width >= 1280) {
          const rows = await card
            .locator(".tags li")
            .evaluateAll((items) =>
              items.map((item) => Math.round(item.getBoundingClientRect().top)),
            );
          expect(new Set(rows).size).toBe(1);
        }
        const image = card.locator(".cover img");
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            image.evaluate(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          )
          .toBe(true);
        await expect(image).toHaveCSS("padding", "0px");
        await expect(image).toHaveCSS("object-fit", "cover");
        const scaleDifference = await image.evaluate((element) => {
          const img = element as HTMLImageElement;
          const box = img.getBoundingClientRect();
          return Math.abs(
            box.width / box.height / (img.naturalWidth / img.naturalHeight) - 1,
          );
        });
        expect(scaleDifference).toBeLessThan(0.005);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await card.screenshot({
          path: `/tmp/sird-card-${route === "/" ? "home" : "archive"}-${width}-${theme}.png`,
        });
      }

      await page.goto("/projects/sird/");
      await expect(page.locator(".project-detail-eyebrow")).toHaveText(
        /Project · Completed MVP · Sep 2026 — Oct 2026/,
      );
      await expect(page.locator(".project-quick-facts dt")).toContainText([
        "Outcome",
      ]);
      await expect(page.locator(".project-related")).toHaveCount(0);
      const diagram = page.locator(
        '.sird-architecture figure[data-role="diagram"]',
      );
      await diagram.scrollIntoViewIfNeeded();
      await expect(diagram).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(diagram).toHaveCSS("padding", "0px");
      const caption = diagram.locator("figcaption");
      const bodyColor = await page
        .locator(".project-case-study > p")
        .first()
        .evaluate((p) => getComputedStyle(p).color);
      await expect(caption).toHaveCSS("color", bodyColor);
      for (const img of await page.locator("article img").all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            img.evaluate(
              (element) =>
                (element as HTMLImageElement).complete &&
                (element as HTMLImageElement).naturalWidth > 0,
            ),
          )
          .toBe(true);
        await expect(img).toHaveCSS("object-fit", "contain");
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await diagram.screenshot({
        path: `/tmp/sird-diagram-${width}-${theme}.png`,
      });
      expect(errors).toEqual([]);

      await page.goto("/projects/vision/");
      const otherDiagram = page.locator('figure[data-role="diagram"]').first();
      await expect(otherDiagram).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      await expect(otherDiagram).toHaveCSS("padding", "16px");
    });
  }
}
