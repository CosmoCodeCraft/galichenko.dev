type RouteId =
  | "1-2"
  | "2-3"
  | "2-5"
  | "3-6"
  | "5-6"
  | "3-4"
  | "5-4"
  | "1-7"
  | "7-3"
  | "3-8"
  | "8-9"
  | "2-10"
  | "3-10"
  | "5-10"
  | "6-10";

type PulseKind =
  "primary" | "telemetry" | "background" | "anomaly" | "feedback";
type HealthyRoute = "a" | "b";

const desktopQuery = "(min-width: 42.01rem)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

class HeroSystemController {
  private readonly routes = new Map<RouteId, SVGPathElement>();
  private readonly animations = new Set<Animation>();
  private readonly activeStrongNodes = new Set<string>();
  private readonly desktop = matchMedia(desktopQuery);
  private readonly reducedMotion = matchMedia(reducedMotionQuery);
  private abortController?: AbortController;
  private speed = 1;
  private started = false;

  constructor(private readonly root: SVGSVGElement) {
    root
      .querySelectorAll<SVGPathElement>("[data-hero-route]")
      .forEach((path) => {
        const id = path.dataset.heroRoute as RouteId | undefined;
        if (id) this.routes.set(id, path);
      });
  }

  init() {
    this.desktop.addEventListener("change", this.handleEnvironmentChange);
    this.reducedMotion.addEventListener("change", this.handleEnvironmentChange);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    if (import.meta.env.DEV) {
      const search = new URLSearchParams(location.search);
      const debugScenario = search.get("hero-debug");
      const debugSpeed = Number.parseFloat(search.get("hero-speed") ?? "1");
      if (debugScenario) {
        this.speed = Number.isFinite(debugSpeed)
          ? Math.min(1, Math.max(0.05, debugSpeed))
          : 1;
        this.startDebugScenario(debugScenario);
        return;
      }
    }

    this.start();
  }

  private readonly handleEnvironmentChange = () => {
    this.stop();
    this.start();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private canRun() {
    return (
      this.desktop.matches && !this.reducedMotion.matches && !document.hidden
    );
  }

  private start() {
    if (this.started || !this.canRun()) return;
    this.started = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    void Promise.allSettled([
      this.runMainLoop(signal),
      this.runBackgroundLoop(signal),
    ]).finally(() => {
      if (this.abortController?.signal === signal) this.started = false;
    });
  }

  private stop() {
    this.abortController?.abort();
    this.abortController = undefined;
    this.started = false;
    this.resetVisualState();
  }

  private startDebugScenario(name: string) {
    if (!this.canRun()) return;
    this.started = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const scenarios: Record<string, () => Promise<void>> = {
      "route-a": () => this.runHealthyRoute("a", signal),
      "route-b": () => this.runHealthyRoute("b", signal),
      failover: () => this.runFailover(signal),
      background: () => this.runBackgroundSync(signal),
      overlap: () =>
        Promise.all([
          this.runHealthyRoute("a", signal),
          this.wait(1200, signal).then(() => this.runBackgroundSync(signal)),
        ]).then(() => undefined),
    };

    const scenario = scenarios[name] ?? scenarios["route-a"];
    void this.wait(300, signal)
      .then(scenario)
      .catch(() => undefined)
      .finally(() => {
        if (this.abortController?.signal === signal) this.started = false;
      });
  }

  private async runMainLoop(signal: AbortSignal) {
    await this.wait(2800, signal);
    while (!signal.aborted) {
      await this.runHealthyRoute("a", signal);
      await this.wait(6000, signal);
      await this.runHealthyRoute("b", signal);
      await this.wait(9000, signal);
      await this.runFailover(signal);
      await this.wait(12000, signal);
    }
  }

  private async runBackgroundLoop(signal: AbortSignal) {
    const rests = [14000, 20000, 17000, 22000];
    let restIndex = 0;
    await this.wait(11000, signal);
    while (!signal.aborted) {
      await this.runBackgroundSync(signal);
      await this.wait(rests[restIndex], signal);
      restIndex = (restIndex + 1) % rests.length;
    }
  }

  private async runHealthyRoute(route: HealthyRoute, signal: AbortSignal) {
    this.root.dataset.heroPhase = `route-${route}`;
    const service = route === "a" ? "3" : "5";
    const routeToService: RouteId = route === "a" ? "2-3" : "2-5";
    const routeToState: RouteId = route === "a" ? "3-6" : "5-6";
    const routeToDownstream: RouteId = route === "a" ? "3-4" : "5-4";

    await this.originate(signal);
    await this.react("router", "2", signal);
    await this.wait(380, signal);
    await this.pulse(routeToService, "primary", 1600, signal);
    await this.react(`service-${service}`, service, signal);
    await this.wait(route === "a" ? 420 : 520, signal);
    await this.pulse(routeToState, "primary", 1800, signal);

    const stateMemory = this.react("persistence", "6", signal);
    await this.wait(560, signal);
    await this.pulse(routeToDownstream, "primary", 1300, signal);
    await this.react("downstream", "4", signal);
    await stateMemory;
    await this.wait(700, signal);
    await this.runObservability(service, signal);
    delete this.root.dataset.heroPhase;
  }

  private async runFailover(signal: AbortSignal) {
    this.root.dataset.heroPhase = "failover";
    await this.originate(signal);
    await this.react("router", "2", signal);
    await this.wait(420, signal);
    await this.pulse("2-3", "primary", 1600, signal);
    await this.react("service-3", "3", signal);

    const fault = this.react("fault-3", "3", signal);
    await this.wait(260, signal);
    const anomaly = this.emitAnomaly(signal);

    await this.pulse("2-3", "feedback", 1200, signal, true);
    await this.react("router", "2", signal);
    await anomaly;
    await fault;
    await this.wait(360, signal);

    await this.pulse("2-5", "primary", 1600, signal);
    await this.react("service-5", "5", signal);
    await this.wait(430, signal);
    await this.pulse("5-6", "primary", 1800, signal);

    const stateMemory = this.react("persistence", "6", signal);
    await this.wait(560, signal);
    await this.pulse("5-4", "primary", 1300, signal);
    await this.react("downstream", "4", signal);
    await stateMemory;
    await this.wait(700, signal);
    await this.runObservability("5", signal);
    delete this.root.dataset.heroPhase;
  }

  private async runBackgroundSync(signal: AbortSignal) {
    this.root.dataset.heroBackground = "sync";
    await this.pulse("1-7", "background", 1500, signal);
    await this.react("aux-7", undefined, signal);
    await this.wait(240, signal);
    await this.pulse("7-3", "background", 1250, signal);
    await this.waitForNodeIdle("3", 900, signal);
    await this.react("aux-3", undefined, signal);
    await this.wait(240, signal);
    await this.pulse("3-8", "background", 1250, signal);
    await this.react("aux-8", undefined, signal);
    await this.wait(240, signal);
    await this.pulse("8-9", "background", 1550, signal);
    await this.react("aux-9", undefined, signal);
    delete this.root.dataset.heroBackground;
  }

  private async originate(signal: AbortSignal) {
    const reaction = this.react("source", "1", signal);
    await this.wait(180, signal);
    await this.pulse("1-2", "primary", 1500, signal);
    await reaction;
  }

  private async runObservability(service: "3" | "5", signal: AbortSignal) {
    this.root.dataset.heroPhase = "observability";
    this.resetTrace();
    const serviceRoute: RouteId = service === "3" ? "3-10" : "5-10";
    const telemetry: RouteId[] = ["2-10", serviceRoute, "6-10"];

    for (const [index, route] of telemetry.entries()) {
      await this.pulse(route, "telemetry", 1300, signal);
      await this.revealTraceStep(index, signal);
      if (index < telemetry.length - 1) await this.wait(500, signal);
    }

    await this.react("observe", "10", signal);
    await this.wait(2500, signal);
    await this.fadeTrace(signal);
  }

  private async emitAnomaly(signal: AbortSignal) {
    await this.pulse("3-10", "anomaly", 1400, signal);
    const marker = this.root.querySelector<SVGElement>(
      "[data-hero-alert-marker]",
    );
    marker?.classList.add("is-visible");
    await this.wait(1400, signal);
    marker?.classList.remove("is-visible");
  }

  private async revealTraceStep(index: number, signal: AbortSignal) {
    const marker = this.root.querySelector<SVGElement>(
      `[data-hero-marker="${index}"]`,
    );
    const span = this.root.querySelector<SVGElement>(
      `[data-hero-trace-span="${index}"]`,
    );
    marker?.classList.add("is-visible");
    if (!span) return;
    span.classList.add("is-visible");
    await this.playClassAnimation(span, "is-drawing", signal);
  }

  private async fadeTrace(signal: AbortSignal) {
    const trace = this.root.querySelector<SVGElement>("[data-hero-trace]");
    const memory = this.root.querySelector<SVGElement>(
      "[data-hero-telemetry-memory]",
    );
    await Promise.all([
      trace ? this.playClassAnimation(trace, "is-fading", signal) : undefined,
      memory ? this.playClassAnimation(memory, "is-fading", signal) : undefined,
    ]);
    this.resetTrace();
  }

  private resetTrace() {
    this.root
      .querySelectorAll<SVGElement>(
        "[data-hero-trace-span], [data-hero-marker]",
      )
      .forEach((element) =>
        element.classList.remove("is-visible", "is-drawing"),
      );
    this.root
      .querySelectorAll<SVGElement>(
        "[data-hero-trace], [data-hero-telemetry-memory]",
      )
      .forEach((element) => element.classList.remove("is-fading"));
  }

  private async react(
    reaction: string,
    strongNode: string | undefined,
    signal: AbortSignal,
  ) {
    const element = this.root.querySelector<SVGElement>(
      `[data-hero-reaction="${reaction}"]`,
    );
    if (!element) return;
    if (strongNode) this.activeStrongNodes.add(strongNode);
    try {
      await this.playClassAnimation(element, "is-active", signal);
    } finally {
      if (strongNode) this.activeStrongNodes.delete(strongNode);
    }
  }

  private async pulse(
    routeId: RouteId,
    kind: PulseKind,
    duration: number,
    signal: AbortSignal,
    reverse = false,
  ) {
    this.throwIfAborted(signal);
    const route = this.routes.get(routeId);
    const pulse = this.root.querySelector<SVGGraphicsElement>(
      `[data-hero-pulse="${kind}"]`,
    );
    const pathData = route?.getAttribute("d");
    if (!pulse || !pathData) return;

    pulse.style.setProperty("offset-path", `path("${pathData}")`);
    pulse.style.setProperty("offset-rotate", reverse ? "auto 180deg" : "auto");
    const start = reverse ? "100%" : "0%";
    const end = reverse ? "0%" : "100%";
    const peakOpacity =
      kind === "background" ? 0.56 : kind === "telemetry" ? 0.82 : 0.94;
    const animation = pulse.animate(
      [
        { offsetDistance: start, opacity: 0, offset: 0 },
        { offsetDistance: start, opacity: peakOpacity * 0.25, offset: 0.08 },
        { opacity: peakOpacity, offset: 0.2 },
        { offsetDistance: end, opacity: peakOpacity, offset: 0.9 },
        { offsetDistance: end, opacity: 0, offset: 1 },
      ],
      {
        duration: this.scaled(duration),
        easing: "cubic-bezier(0.28, 0.05, 0.3, 1)",
      },
    );
    await this.trackAnimation(animation, signal);
  }

  private async playClassAnimation(
    element: SVGElement,
    className: string,
    signal: AbortSignal,
  ) {
    this.throwIfAborted(signal);
    element.classList.remove(className);
    void element.getBoundingClientRect();
    element.classList.add(className);
    const animations = element.getAnimations();
    if (animations.length === 0) {
      element.classList.remove(className);
      return;
    }

    animations.forEach((animation) => {
      animation.playbackRate = 1 / this.speed;
      this.animations.add(animation);
    });
    try {
      await this.waitForAnimations(animations, signal);
    } finally {
      animations.forEach((animation) => this.animations.delete(animation));
      element.classList.remove(className);
    }
  }

  private async trackAnimation(animation: Animation, signal: AbortSignal) {
    this.animations.add(animation);
    try {
      await this.waitForAnimations([animation], signal);
    } finally {
      this.animations.delete(animation);
      animation.cancel();
    }
  }

  private async waitForAnimations(
    animations: Animation[],
    signal: AbortSignal,
  ) {
    let handleAbort: (() => void) | undefined;
    const abort = new Promise<never>((_, reject) => {
      handleAbort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", handleAbort, { once: true });
    });
    try {
      await Promise.race([
        Promise.allSettled(animations.map((animation) => animation.finished)),
        abort,
      ]);
      this.throwIfAborted(signal);
    } finally {
      if (handleAbort) signal.removeEventListener("abort", handleAbort);
    }
  }

  private async waitForNodeIdle(
    node: string,
    maximumWait: number,
    signal: AbortSignal,
  ) {
    let waited = 0;
    while (this.activeStrongNodes.has(node) && waited < maximumWait) {
      await this.wait(120, signal);
      waited += 120;
    }
  }

  private wait(milliseconds: number, signal: AbortSignal) {
    this.throwIfAborted(signal);
    return new Promise<void>((resolve, reject) => {
      const handleAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = window.setTimeout(() => {
        signal.removeEventListener("abort", handleAbort);
        resolve();
      }, this.scaled(milliseconds));
      signal.addEventListener("abort", handleAbort, { once: true });
    });
  }

  private scaled(milliseconds: number) {
    return Math.max(20, milliseconds * this.speed);
  }

  private throwIfAborted(signal: AbortSignal) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  private resetVisualState() {
    this.animations.forEach((animation) => animation.cancel());
    this.animations.clear();
    this.activeStrongNodes.clear();
    delete this.root.dataset.heroPhase;
    delete this.root.dataset.heroBackground;
    this.root
      .querySelectorAll<SVGElement>(
        ".is-active, .is-visible, .is-drawing, .is-fading",
      )
      .forEach((element) =>
        element.classList.remove(
          "is-active",
          "is-visible",
          "is-drawing",
          "is-fading",
        ),
      );
    this.root
      .querySelectorAll<SVGGraphicsElement>("[data-hero-pulse]")
      .forEach((pulse) => {
        pulse.style.removeProperty("offset-path");
        pulse.style.removeProperty("offset-rotate");
      });
  }
}

export function initHeroSystem() {
  const root = document.querySelector<SVGSVGElement>("[data-hero-system]");
  if (!root) return;
  new HeroSystemController(root).init();
}
