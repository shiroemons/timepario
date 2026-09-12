/** ドロップが成立するまではカードの順序と履歴を変更しない。 */
export function enableReordering(
  grid: HTMLElement,
  onMove: (from: number, to: number) => void,
): () => void {
  let cancel: (() => void) | undefined;
  let cancelSettling: (() => void) | undefined;

  function settle(previous: Map<string | undefined, DOMRect>, movedZone: string | undefined) {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;
    const animations = new Set<Animation>();
    const observer = new MutationObserver(clear);

    function clear() {
      observer.disconnect();
      reducedMotion.removeEventListener("change", clear);
      window.removeEventListener("resize", clear);
      window.removeEventListener("pagehide", clear);
      for (const animation of animations) {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
      }
      animations.clear();
      grid.classList.remove("is-settling");
      cancelSettling = undefined;
    }

    // DOM の並び替え後に元の位置との差分だけを描画し、履歴の更新とは分離する。
    for (const card of grid.querySelectorAll<HTMLElement>(".clock-card")) {
      const before = previous.get(card.dataset.zone);
      if (!before || typeof card.animate !== "function") continue;
      const after = card.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      const scaleX = before.width / after.width;
      const scaleY = before.height / after.height;
      if (
        Math.abs(x) +
          Math.abs(y) +
          Math.abs(before.width - after.width) +
          Math.abs(before.height - after.height) <
        1
      )
        continue;
      const moved = card.dataset.zone === movedZone;
      const animation = card.animate(
        [
          {
            transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "0 0",
            zIndex: moved ? 2 : 1,
          },
          { transform: "translate(0, 0) scale(1)", transformOrigin: "0 0", zIndex: moved ? 2 : 1 },
        ],
        { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      animations.add(animation);
      animation.onfinish = animation.oncancel = () => {
        animations.delete(animation);
        if (!animations.size) clear();
      };
    }
    if (!animations.size) return;
    grid.classList.add("is-settling");
    cancelSettling = clear;
    observer.observe(grid, { childList: true });
    reducedMotion.addEventListener("change", clear);
    window.addEventListener("resize", clear);
    window.addEventListener("pagehide", clear);
  }

  function start(event: PointerEvent) {
    if (cancel || !event.isPrimary || event.button !== 0) return;
    const handle = (event.target as Element).closest<HTMLButtonElement>(".drag-handle");
    if (!handle || handle.disabled || !grid.contains(handle)) return;
    cancelSettling?.();
    const cards = [...grid.querySelectorAll<HTMLElement>(".clock-card")];
    const from = Number(handle.dataset.index);
    const source = cards[from];
    if (cards.length < 2 || !source || source !== handle.closest(".clock-card")) return;

    event.preventDefault();
    handle.focus({ preventScroll: true });
    const pointerId = event.pointerId;
    const initialScrollX = scrollX;
    const initialScrollY = scrollY;
    let dragging = false;
    let target: HTMLElement | null = null;
    const observer = new MutationObserver(stop);

    function unchanged() {
      return grid.isConnected && cards.every((card, index) => grid.children[index] === card);
    }

    function locate(x: number, y: number) {
      const bounds = grid.getBoundingClientRect();
      if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>(".clock-card");
      return hit && cards.includes(hit) ? hit : null;
    }

    function move(next: PointerEvent) {
      if (next.pointerId !== pointerId) return;
      if (!unchanged()) return stop();
      if (!dragging && Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) < 6)
        return;
      next.preventDefault();
      dragging = true;
      source?.style.setProperty(
        "--drag-x",
        `${next.clientX - event.clientX + scrollX - initialScrollX}px`,
      );
      source?.style.setProperty(
        "--drag-y",
        `${next.clientY - event.clientY + scrollY - initialScrollY}px`,
      );
      grid.classList.add("is-reordering");
      source?.classList.add("is-dragging");
      target?.classList.remove("drop-target");
      target = locate(next.clientX, next.clientY);
      if (target !== source) target?.classList.add("drop-target");
    }

    function stop() {
      observer.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", abort);
      window.removeEventListener("lostpointercapture", abort);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", stop);
      window.removeEventListener("resize", stop);
      if (handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      grid.classList.remove("is-reordering");
      source?.classList.remove("is-dragging");
      source?.style.removeProperty("--drag-x");
      source?.style.removeProperty("--drag-y");
      target?.classList.remove("drop-target");
      cancel = undefined;
    }

    function drop(next: PointerEvent) {
      if (next.pointerId !== pointerId) return;
      const destination = dragging && unchanged() ? locate(next.clientX, next.clientY) : null;
      const to = destination ? cards.indexOf(destination) : -1;
      const previous = new Map(
        cards.map((card) => [card.dataset.zone, card.getBoundingClientRect()]),
      );
      stop();
      if (to >= 0 && to !== from) {
        onMove(from, to);
        settle(previous, source?.dataset.zone);
      }
    }

    function abort(next: PointerEvent) {
      if (next.pointerId === pointerId) stop();
    }

    function keydown(next: KeyboardEvent) {
      if (next.key !== "Escape") return;
      next.preventDefault();
      stop();
    }

    cancel = stop;
    observer.observe(grid, { childList: true });
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", abort);
    window.addEventListener("lostpointercapture", abort);
    window.addEventListener("keydown", keydown);
    window.addEventListener("blur", stop);
    window.addEventListener("resize", stop);
    // 合成イベントにはブラウザーの有効なポインターがなく、キャプチャできない。
    if (event.isTrusted && handle.isConnected) handle.setPointerCapture(pointerId);
  }

  grid.addEventListener("pointerdown", start);
  return () => {
    cancel?.();
    cancelSettling?.();
    grid.removeEventListener("pointerdown", start);
  };
}
