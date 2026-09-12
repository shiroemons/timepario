export function registerPwa(onFailure: () => void): void {
  if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
  async function register() {
    try {
      const serviceWorker = navigator.serviceWorker;
      if (!serviceWorker?.register) return;
      const registration = await serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      let observed: ServiceWorker | null = null;
      function watchInstallation() {
        const worker = registration.installing;
        if (!worker || worker === observed) return;
        observed = worker;
        function checkState() {
          if (!worker) return;
          if (worker.state === "redundant") {
            if (registration.active) {
              console.warn(
                "Offline update failed; the previous offline version remains available.",
              );
            } else {
              console.error("Initial offline installation failed.");
              onFailure();
            }
          }
          if (worker.state === "redundant" || worker.state === "activated") {
            worker.removeEventListener("statechange", checkState);
          }
        }
        worker.addEventListener("statechange", checkState);
        checkState();
      }
      registration.addEventListener("updatefound", watchInstallation);
      watchInstallation();
    } catch (error) {
      console.error("Could not prepare offline clocks:", error);
      onFailure();
    }
  }
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", register, { once: true });
}
