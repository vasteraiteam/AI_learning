import { expect, test } from "@playwright/test";

test("renders the PDF and passes the selected page and exercise to Mia", async ({
  page,
}) => {
  await page.goto("/courses/math-7/materials/equations-1");
  await expect(
    page.getByRole("heading", { name: "第 3 章 · 一元一次方程.pdf" }),
  ).toBeVisible();
  const reader = page.locator(".material-viewport");
  const pageCanvas = (number: number) =>
    reader.locator(`[data-page-number="${number}"] canvas`);
  const canvas = pageCanvas(2);
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext("2d")
          ?.getImageData(0, 0, element.width, element.height).data;
        if (!pixels) return false;
        for (let index = 0; index < pixels.length; index += 4) {
          if (
            pixels[index + 3] === 255 &&
            pixels[index] < 120 &&
            pixels[index + 1] < 120 &&
            pixels[index + 2] < 200
          )
            return true;
        }
        return false;
      }),
    )
    .toBe(true);

  await page.getByRole("button", { name: "上一页" }).click();
  await expect(pageCanvas(1)).toBeVisible();
  await expect(page.getByRole("button", { name: "选择例题 02" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(pageCanvas(2)).toBeVisible();

  const exercise = page.getByRole("button", { name: "选择例题 02" });
  await exercise.click();
  await expect(exercise).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "打开 Mia" }).click();
  const panel = page.getByRole("dialog", { name: "Mia" });
  await expect(panel.locator('[aria-label="学习上下文"]')).toContainText(
    "第 2 页 · 3(x − 2) = 12",
  );
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "打开 Mia" })).toBeFocused();
});
