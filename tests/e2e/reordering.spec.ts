import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const fixed = new Date("2026-07-01T12:34:56.000Z");
  await page.clock.install({ time: new Date(fixed.getTime() - 60_000) });
  await page.clock.pauseAt(fixed);
});

async function startDrag(page: Page, from: number, to: number) {
  const source = await page.locator(".drag-handle").nth(from).boundingBox();
  if (!source) throw new Error("Drag source must be visible");
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  const target = await page.locator(".clock-card").nth(to).boundingBox();
  if (!target) throw new Error("Drag destination must be visible");
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
}

async function freezeNextDrop(page: Page, time = 100) {
  await page.evaluate((time) => {
    window.addEventListener(
      "pointerup",
      () => {
        for (const animation of document
          .querySelector("#clock-grid")
          ?.getAnimations({ subtree: true }) ?? []) {
          animation.pause();
          animation.currentTime = time;
        }
      },
      { once: true },
    );
  }, time);
}

async function finishDrop(page: Page) {
  await page.evaluate(() => {
    for (const animation of document
      .querySelector("#clock-grid")
      ?.getAnimations({ subtree: true }) ?? [])
      animation.finish();
  });
  await page.clock.runFor(320);
  await expect
    .poll(() =>
      page.locator("#clock-grid").evaluate((grid) => grid.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
}

for (const [width, height] of [
  [1280, 720],
  [390, 844],
] as const) {
  test(`pointer drag moves a clock across two positions at ${width}px and creates one history entry`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/utc,jst,pt");
    const historyLength = await page.evaluate(() => history.length);
    await startDrag(page, 0, 2);
    await expect(page.locator(".is-dragging")).toHaveAttribute("data-zone", "utc");
    await expect(page.locator(".drop-target")).toHaveAttribute("data-zone", "pt");
    await expect(page.locator(".is-dragging")).not.toHaveCSS("transform", "none");
    await expect(page.locator(".drop-target")).toHaveCSS("outline-width", "3px");
    await expect(page.locator(".clock-card")).toHaveCount(3);
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-${width}-drag-feedback.png`,
    });
    await expect(page).toHaveURL(/\/utc,jst,pt$/);
    const beforeDrop = await page.locator('[data-zone="utc"]').boundingBox();
    await freezeNextDrop(page, 0);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/jst,pt,utc$/);
    expect(
      await page
        .locator(".clock-card")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-zone"))),
    ).toEqual(["jst", "pt", "utc"]);
    expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
    await expect(page.locator(".is-dragging, .drop-target, .is-reordering")).toHaveCount(0);
    expect(
      await page
        .locator("#clock-grid")
        .evaluate((grid) => grid.getAnimations({ subtree: true }).length),
    ).toBe(3);
    const afterDrop = await page.locator('[data-zone="utc"]').boundingBox();
    if (!beforeDrop || !afterDrop)
      throw new Error("The moved clock must remain visible on release");
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(afterDrop[dimension]).toBeCloseTo(beforeDrop[dimension], 1);
    }
    await page.locator("#clock-grid").evaluate((grid) => {
      for (const animation of grid.getAnimations({ subtree: true })) animation.currentTime = 100;
    });
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-${width}-drop-motion.png`,
    });
    await finishDrop(page);
    for (const card of await page.locator(".clock-card").all())
      await expect(card).toHaveCSS("transform", "none");
    await page.goBack();
    await expect(page).toHaveURL(/\/utc,jst,pt$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/jst,pt,utc$/);
    const earlier = page.locator('[data-zone="utc"] [data-action="earlier"]');
    await earlier.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/jst,utc,pt$/);
  });
}

test("Escape, outside drops and short clicks cancel without changing history", async ({ page }) => {
  await page.goto("/utc,jst,pt");
  const historyLength = await page.evaluate(() => history.length);
  await startDrag(page, 0, 2);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page).toHaveURL(/\/utc,jst,pt$/);
  await startDrag(page, 0, 2);
  await page.mouse.move(1, 1);
  await expect(page.locator(".drop-target")).toHaveCount(0);
  await page.mouse.up();
  await page.locator(".drag-handle").first().click();
  await expect(page).toHaveURL(/\/utc,jst,pt$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator(".is-dragging, .drop-target, .is-reordering")).toHaveCount(0);
});

test("touch and pen pointer sequences reorder, pointercancel leaves history untouched", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/utc,jst,pt");
  const historyLength = await page.evaluate(() => history.length);
  for (const [pointerType, cancelled] of [
    ["touch", true],
    ["touch", false],
    ["pen", false],
  ] as const) {
    if (pointerType === "touch" && browserName === "chromium") {
      const session = await page.context().newCDPSession(page);
      const source = await page.locator(".drag-handle").first().boundingBox();
      const target = await page.locator(".clock-card").nth(2).boundingBox();
      if (!source || !target) throw new Error("Missing touch drag source or destination");
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: target.x + target.width / 2, y: target.y + target.height / 2 }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: cancelled ? "touchCancel" : "touchEnd",
        touchPoints: [],
      });
      await session.detach();
    } else
      await page.evaluate(
        ({ pointerType, cancelled }) => {
          const handles = document.querySelectorAll<HTMLButtonElement>(".drag-handle");
          const cards = document.querySelectorAll<HTMLElement>(".clock-card");
          const handle = handles[0];
          const destination = cards[2];
          if (!handle || !destination) throw new Error("Missing sortable cards");
          const source = handle.getBoundingClientRect();
          const options = {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType,
            isPrimary: true,
            button: 0,
          };
          handle.dispatchEvent(
            new PointerEvent("pointerdown", {
              ...options,
              clientX: source.x + source.width / 2,
              clientY: source.y + source.height / 2,
            }),
          );
          const target = destination.getBoundingClientRect();
          const end = {
            ...options,
            clientX: target.x + target.width / 2,
            clientY: target.y + target.height / 2,
          };
          window.dispatchEvent(new PointerEvent("pointermove", end));
          window.dispatchEvent(new PointerEvent(cancelled ? "pointercancel" : "pointerup", end));
        },
        { pointerType, cancelled },
      );
    const order = cancelled ? "utc,jst,pt" : pointerType === "touch" ? "jst,pt,utc" : "pt,utc,jst";
    await expect(page).toHaveURL(new RegExp(`/${order}$`));
    expect(await page.evaluate(() => history.length)).toBe(
      historyLength + (cancelled ? 0 : pointerType === "touch" ? 1 : 2),
    );
    await expect(page.locator(".is-dragging, .drop-target, .is-reordering")).toHaveCount(0);
  }
});

test("history restoration during a drag discards stale card indexes", async ({ page }) => {
  await page.goto("/utc,jst,pt");
  await page.locator('[data-zone="utc"] [data-action="later"]').click();
  await expect(page).toHaveURL(/\/jst,utc,pt$/);
  await startDrag(page, 0, 2);
  await page.goBack();
  await expect(page).toHaveURL(/\/utc,jst,pt$/);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/utc,jst,pt$/);
  await expect(page.locator(".is-dragging, .drop-target, .is-reordering")).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/\/jst,utc,pt$/);
});

test("one clock has no active drag handle", async ({ page }) => {
  await page.goto("/utc");
  await expect(page.locator(".drag-handle:not(:disabled)")).toHaveCount(0);
  await expect(page.locator(".clock-card")).toHaveCount(1);
});

test("reduced motion preserves drag feedback and commits the order without movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/utc,jst,pt");
  const historyLength = await page.evaluate(() => history.length);
  await startDrag(page, 0, 2);
  await expect(page.locator(".is-dragging")).not.toHaveCSS("transform", "none");
  expect(
    await page.locator(".is-dragging").evaluate((card) => {
      const matrix = new DOMMatrix(getComputedStyle(card).transform);
      return [matrix.a, matrix.d];
    }),
  ).toEqual([1, 1]);
  await expect(page.locator(".drop-target")).toHaveCSS("outline-width", "3px");
  await freezeNextDrop(page);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/jst,pt,utc$/);
  expect(
    await page
      .locator("#clock-grid")
      .evaluate((grid) => grid.getAnimations({ subtree: true }).length),
  ).toBe(0);
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  for (const card of await page.locator(".clock-card").all())
    await expect(card).toHaveCSS("transform", "none");
});

for (const [width, height] of [
  [1280, 720],
  [390, 844],
] as const) {
  test(`two clocks follow circular pointer movement and outside cancellation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/jst,pst");
    const card = page.locator('[data-zone="jst"]');
    const initial = await card.boundingBox();
    const handle = await card.locator(".drag-handle").boundingBox();
    if (!initial || !handle) throw new Error("The source clock and handle must be visible");
    const grab = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    const historyLength = await page.evaluate(() => history.length);
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    for (const [x, y] of [
      [35, -30],
      [70, 0],
      [35, 35],
      [0, 50],
      [-35, 20],
      [-35, -30],
      [0, 0],
    ]) {
      await page.mouse.move(grab.x + (x ?? 0), grab.y + (y ?? 0), { steps: 3 });
      const moved = await card.boundingBox();
      if (!moved) throw new Error("The dragged card must remain visible");
      expect(moved.x + moved.width / 2).toBeCloseTo(initial.x + initial.width / 2 + (x ?? 0), 1);
      expect(moved.y + moved.height / 2).toBeCloseTo(
        initial.y + initial.height / 2 + (y ?? 0) - 6,
        1,
      );
      await expect(page).toHaveURL(/\/jst,pst$/);
      await expect(page.locator(".clock-card")).toHaveCount(2);
    }
    await page.mouse.up();
    await expect(page).toHaveURL(/\/jst,pst$/);
    await expect(card).toHaveCSS("transform", "none");
    await startDrag(page, 0, 1);
    await expect(page.locator(".drop-target")).toHaveAttribute("data-zone", "pst");
    await page.mouse.move(40, 80, { steps: 5 });
    await expect(page.locator(".is-dragging")).toHaveCount(1);
    await expect(page.locator(".drop-target")).toHaveCount(0);
    await expect(page.locator("html")).toHaveCSS("overflow-x", "clip");
    await page.screenshot({
      path: `output/playwright/${testInfo.project.name}-${width}-drag-outside.png`,
    });
    await page.mouse.up();
    await expect(page).toHaveURL(/\/jst,pst$/);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
    await expect(card).toHaveCSS("transform", "none");
    expect(
      await card.evaluate((node) => [
        node.style.getPropertyValue("--drag-x"),
        node.style.getPropertyValue("--drag-y"),
      ]),
    ).toEqual(["", ""]);
    await expect(page.locator(".is-dragging, .is-reordering, .is-settling")).toHaveCount(0);
  });
}

test("a rapid second drag and history restoration cancel settling effects", async ({ page }) => {
  await page.goto("/utc,jst,pt");
  const historyLength = await page.evaluate(() => history.length);
  await startDrag(page, 0, 2);
  await freezeNextDrop(page, 0);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/jst,pt,utc$/);
  await startDrag(page, 2, 0);
  expect(
    await page
      .locator("#clock-grid")
      .evaluate((grid) => grid.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page).toHaveURL(/\/jst,pt,utc$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  await startDrag(page, 2, 0);
  await freezeNextDrop(page, 0);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/utc,jst,pt$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/jst,pt,utc$/);
  expect(
    await page
      .locator("#clock-grid")
      .evaluate((grid) => grid.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(page.locator(".is-dragging, .drop-target, .is-reordering")).toHaveCount(0);
  await expect(page.locator(".clock-card")).toHaveCount(3);
});
