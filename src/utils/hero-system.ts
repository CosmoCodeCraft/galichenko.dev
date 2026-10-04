import {
  HERO_QUEUE_CAPACITY,
  HeroSystemModel,
  type HeroRequestKind,
  type HeroServiceId,
} from "./hero-system-model";

type RouteId =
  | "1-2"
  | "2-3"
  | "2-5"
  | "3-6"
  | "5-6"
  | "3-4"
  | "5-4"
  | "4-6"
  | "1-7"
  | "7-3"
  | "3-8"
  | "8-9"
  | "2-10"
  | "3-10"
  | "5-10"
  | "6-10";

type PulseKind =
  | "normal"
  | "heavy"
  | "telemetry"
  | "background"
  | "anomaly"
  | "feedback"
  | "probe";

interface HeroRequest {
  id: number;
  kind: HeroRequestKind;
}

interface LastTrace {
  failedRoutes: RouteId[];
  failedService?: HeroServiceId;
  kind: HeroRequestKind;
  outcome: "healthy" | "failover";
  routes: RouteId[];
  service: HeroServiceId;
  telemetry: RouteId[];
}

interface HoldGesture {
  armed: boolean;
  cancelled: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  timer?: number;
}

const desktopQuery = "(min-width: 42.01rem)";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const finePointerQuery = "(hover: hover) and (pointer: fine)";

class HeroSystemController {
  private readonly routes = new Map<RouteId, SVGPathElement>();
  private readonly pulseTemplates = new Map<PulseKind, SVGGraphicsElement>();
  private readonly animations = new Set<Animation>();
  private readonly pulseInstances = new Set<SVGGraphicsElement>();
  private readonly strongNodes = new Map<string, number>();
  private readonly reactionLocks = new Map<string, Promise<void>>();
  private readonly model = new HeroSystemModel();
  private readonly desktop = matchMedia(desktopQuery);
  private readonly reducedMotion = matchMedia(reducedMotionQuery);
  private readonly finePointer = matchMedia(finePointerQuery);
  private readonly queue: HeroRequest[] = [];
  private readonly pulseLayer: SVGGElement | null;
  private abortController?: AbortController;
  private inspectionAbort?: AbortController;
  private hold?: HoldGesture;
  private lastTrace?: LastTrace;
  private pendingInspectionAt?: number;
  private persistenceTask?: Promise<void>;
  private persistenceUntil = 0;
  private requestId = 0;
  private ambientPauseUntil = 0;
  private ambientActive = false;
  private inspectionActive = false;
  private manualPrimaryCount = 0;
  private manualTelemetryCount = 0;
  private pumpRunning = false;
  private retryReserved = false;
  private maintenanceRunning = false;
  private probeRunning = false;
  private started = false;

  constructor(private readonly root: SVGSVGElement) {
    root
      .querySelectorAll<SVGPathElement>("[data-hero-route]")
      .forEach((path) => {
        const id = path.dataset.heroRoute as RouteId | undefined;
        if (id) this.routes.set(id, path);
      });
    root
      .querySelectorAll<SVGGraphicsElement>("[data-hero-pulse-template]")
      .forEach((template) => {
        const kind = template.dataset.heroPulseTemplate as
          PulseKind | undefined;
        if (kind) this.pulseTemplates.set(kind, template);
      });
    this.pulseLayer = root.querySelector<SVGGElement>(
      "[data-hero-pulse-layer]",
    );
  }

  init() {
    this.model.reset(performance.now());
    this.bindInteractions();
    this.desktop.addEventListener("change", this.handleEnvironmentChange);
    this.reducedMotion.addEventListener("change", this.handleEnvironmentChange);
    this.finePointer.addEventListener("change", this.handlePointerChange);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.configureControls();
    this.start();
  }

  private readonly handleEnvironmentChange = () => {
    this.stop();
    this.configureControls();
    this.start();
  };

  private readonly handlePointerChange = () => {
    this.cancelHold();
    this.clearNeighborhood();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.stop();
    else {
      this.configureControls();
      this.start();
    }
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
      this.runAmbientLoop(signal),
      this.runBackgroundLoop(signal),
    ]).finally(() => {
      if (this.abortController?.signal === signal) this.started = false;
    });
  }

  private stop() {
    this.abortController?.abort();
    this.abortController = undefined;
    this.endInspection();
    this.cancelHold();
    this.queue.length = 0;
    this.started = false;
    this.ambientActive = false;
    this.inspectionActive = false;
    this.manualPrimaryCount = 0;
    this.manualTelemetryCount = 0;
    this.pumpRunning = false;
    this.retryReserved = false;
    this.maintenanceRunning = false;
    this.probeRunning = false;
    this.pendingInspectionAt = undefined;
    this.lastTrace = undefined;
    this.persistenceTask = undefined;
    this.persistenceUntil = 0;
    this.model.reset(performance.now());
    this.resetVisualState();
    this.configureControls();
  }

  private configureControls() {
    const enabled = this.canRun();
    this.root.classList.toggle("is-interactive", enabled);
    this.root
      .querySelectorAll<SVGGraphicsElement>("[data-hero-action]")
      .forEach((control) => {
        if (enabled) {
          control.setAttribute("role", "button");
          control.setAttribute("tabindex", "0");
          control.setAttribute(
            "aria-label",
            control.dataset.heroControlLabel ?? "",
          );
        } else {
          control.removeAttribute("role");
          control.removeAttribute("tabindex");
          control.removeAttribute("aria-label");
        }
      });
  }

  private bindInteractions() {
    this.root
      .querySelectorAll<SVGGraphicsElement>("[data-hero-hit-node]")
      .forEach((hitArea) => {
        hitArea.addEventListener("pointerenter", () => {
          if (this.finePointer.matches && this.canRun())
            this.showNeighborhood(hitArea.dataset.heroHitNode ?? "");
        });
        hitArea.addEventListener("pointerleave", () => {
          if (this.finePointer.matches) this.clearNeighborhood();
        });
      });

    const source = this.actionControl("source");
    source?.addEventListener("pointerdown", this.handleSourcePointerDown);
    source?.addEventListener("pointermove", this.handleSourcePointerMove);
    source?.addEventListener("pointerup", this.handleSourcePointerUp);
    source?.addEventListener("pointercancel", this.handleSourcePointerCancel);
    source?.addEventListener(
      "lostpointercapture",
      this.handleSourcePointerCancel,
    );
    source?.addEventListener("keydown", this.handleSourceKeyDown);
    source?.addEventListener("focus", () => this.showNeighborhood("1"));
    source?.addEventListener("blur", () => this.clearNeighborhood());

    const observe = this.actionControl("observe");
    observe?.addEventListener("click", this.handleObserveClick);
    observe?.addEventListener("keydown", this.handleObserveKeyDown);
    observe?.addEventListener("focus", () => this.showNeighborhood("10"));
    observe?.addEventListener("blur", () => this.clearNeighborhood());
  }

  private actionControl(action: "source" | "observe") {
    return this.root.querySelector<SVGGraphicsElement>(
      `[data-hero-action="${action}"]`,
    );
  }

  private readonly handleSourcePointerDown = (event: PointerEvent) => {
    if (!this.canRun() || event.button !== 0 || this.hold) return;
    const source = event.currentTarget as SVGGraphicsElement;
    source.setPointerCapture(event.pointerId);
    const hold: HoldGesture = {
      armed: false,
      cancelled: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    this.hold = hold;
    if (this.finePointer.matches) {
      const ring = this.root.querySelector<SVGElement>("[data-hero-hold-ring]");
      ring?.classList.add("is-holding");
      hold.timer = window.setTimeout(() => {
        if (this.hold !== hold || hold.cancelled) return;
        hold.armed = true;
        ring?.classList.add("is-armed");
      }, 700);
    }
  };

  private readonly handleSourcePointerMove = (event: PointerEvent) => {
    const hold = this.hold;
    if (!hold || hold.pointerId !== event.pointerId || hold.cancelled) return;
    if (
      Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY) > 10
    ) {
      hold.cancelled = true;
      if (hold.timer) clearTimeout(hold.timer);
      this.clearHoldVisual();
    }
  };

  private readonly handleSourcePointerUp = (event: PointerEvent) => {
    const hold = this.hold;
    if (!hold || hold.pointerId !== event.pointerId) return;
    const source = event.currentTarget as SVGGraphicsElement;
    this.hold = undefined;
    if (hold.timer) clearTimeout(hold.timer);
    this.clearHoldVisual();
    if (source.hasPointerCapture(event.pointerId))
      source.releasePointerCapture(event.pointerId);
    if (!hold.cancelled) this.enqueueRequest(hold.armed ? "heavy" : "normal");
  };

  private readonly handleSourcePointerCancel = (event: PointerEvent) => {
    if (this.hold?.pointerId !== event.pointerId) return;
    this.cancelHold();
  };

  private readonly handleSourceKeyDown = (event: KeyboardEvent) => {
    if (
      !this.canRun() ||
      event.repeat ||
      (event.key !== "Enter" && event.key !== " ")
    )
      return;
    event.preventDefault();
    this.enqueueRequest("normal");
  };

  private readonly handleObserveClick = (event: MouseEvent) => {
    if (!this.canRun() || event.button !== 0) return;
    this.requestInspection();
  };

  private readonly handleObserveKeyDown = (event: KeyboardEvent) => {
    if (
      !this.canRun() ||
      event.repeat ||
      (event.key !== "Enter" && event.key !== " ")
    )
      return;
    event.preventDefault();
    this.requestInspection();
  };

  private cancelHold() {
    if (this.hold?.timer) clearTimeout(this.hold.timer);
    this.hold = undefined;
    this.clearHoldVisual();
  }

  private clearHoldVisual() {
    this.root
      .querySelector("[data-hero-hold-ring]")
      ?.classList.remove("is-holding", "is-armed");
  }

  private enqueueRequest(kind: HeroRequestKind) {
    if (!this.canRun()) return;
    this.endInspection();
    const signal = this.abortController?.signal;
    if (!signal) return;
    const accepted = this.queue.length < HERO_QUEUE_CAPACITY;
    const now = performance.now();
    this.model.recordSource(kind, accepted, now);
    this.ambientPauseUntil = now + 12000;
    this.ensureMaintenanceLoop(signal);

    if (!accepted) {
      void this.react("rate-limit", undefined, signal, "is-warn").catch(
        () => undefined,
      );
      this.updateServiceVisuals();
      return;
    }

    this.queue.push({ id: ++this.requestId, kind });
    this.updateQueueMarkers();
    void this.react(
      "source",
      "1",
      signal,
      kind === "heavy" ? "is-heavy" : undefined,
    ).catch(() => undefined);
    void this.pumpQueue(signal);
  }

  private async pumpQueue(signal: AbortSignal) {
    if (this.pumpRunning || this.retryReserved || signal.aborted) return;
    this.pumpRunning = true;
    try {
      while (this.queue.length > 0 && !this.retryReserved) {
        const service = this.model.chooseService(performance.now());
        if (!service || !this.model.reserve(service)) break;
        const request = this.queue.shift();
        if (!request) {
          this.model.release(service, performance.now());
          break;
        }
        this.updateQueueMarkers();
        this.manualPrimaryCount += 1;
        void this.runManualTransaction(request, service, signal)
          .catch(() => undefined)
          .finally(() => {
            this.manualPrimaryCount = Math.max(0, this.manualPrimaryCount - 1);
            void this.pumpQueue(signal);
            this.maybeRunPendingInspection(signal);
          });
        await this.wait(380, signal);
      }
    } finally {
      this.pumpRunning = false;
    }
  }

  private async runManualTransaction(
    request: HeroRequest,
    initialService: HeroServiceId,
    signal: AbortSignal,
  ) {
    const successfulRoutes: RouteId[] = ["1-2"];
    let service = initialService;
    let failedService: HeroServiceId | undefined;
    let failedRoutes: RouteId[] = [];

    await this.pulse("1-2", request.kind, 1500, signal);
    await this.react("router", "2", signal);
    await this.wait(380, signal);
    const firstServiceRoute = this.routeToService(service);
    successfulRoutes.push(firstServiceRoute);
    await this.pulse(firstServiceRoute, request.kind, 1600, signal);

    const assignment = this.model.assign(
      service,
      request.kind,
      performance.now(),
    );
    this.updateServiceVisuals();
    if (assignment.shouldTrip) this.retryReserved = true;
    await this.react(
      `service-${service}`,
      service,
      signal,
      request.kind === "heavy" ? "is-heavy" : undefined,
    );
    await this.wait(request.kind === "heavy" ? 950 : 450, signal);

    if (assignment.shouldTrip) {
      failedService = service;
      failedRoutes = [firstServiceRoute, this.telemetryRoute(service)];
      service = await this.failAndRetry(service, request.kind, signal);
      successfulRoutes.push(this.routeToService(service));
    } else {
      this.model.release(service, performance.now());
      void this.pumpQueue(signal);
    }

    const completionRoutes = await this.completeTransaction(
      service,
      request.kind,
      signal,
    );
    successfulRoutes.push(...completionRoutes);
    const telemetry = [
      "2-10" as const,
      this.telemetryRoute(service),
      "6-10" as const,
    ];
    this.lastTrace = {
      failedRoutes,
      failedService,
      kind: request.kind,
      outcome: failedService ? "failover" : "healthy",
      routes: successfulRoutes,
      service,
      telemetry,
    };
    this.retryReserved = false;
    void this.pumpQueue(signal);
    void this.runManualTelemetry(telemetry, signal).catch(() => undefined);
  }

  private async failAndRetry(
    failed: HeroServiceId,
    kind: HeroRequestKind,
    signal: AbortSignal,
  ): Promise<HeroServiceId> {
    const failedState = this.root.querySelector<SVGElement>(
      `[data-hero-service-state="${failed}"]`,
    );
    failedState?.classList.add("is-faulting");
    const anomaly = this.emitAnomaly(failed, signal);
    await this.wait(180, signal);
    await this.pulse(
      this.routeToService(failed),
      "feedback",
      1400,
      signal,
      true,
    );
    await this.react("router", "2", signal, "is-alert");
    this.model.open(failed, performance.now());
    this.updateServiceVisuals();
    await anomaly;
    failedState?.classList.remove("is-faulting");

    const peer: HeroServiceId = failed === "3" ? "5" : "3";
    while (!this.model.reserve(peer)) {
      await this.wait(240, signal);
    }
    this.throwIfAborted(signal);

    await this.wait(320, signal);
    await this.pulse(this.routeToService(peer), kind, 1600, signal);
    this.model.assign(peer, kind, performance.now());
    this.updateServiceVisuals();
    await this.react(
      `service-${peer}`,
      peer,
      signal,
      kind === "heavy" ? "is-heavy" : undefined,
    );
    await this.wait(kind === "heavy" ? 950 : 450, signal);
    this.model.release(peer, performance.now());
    this.retryReserved = false;
    void this.pumpQueue(signal);
    return peer;
  }

  private async completeTransaction(
    service: HeroServiceId,
    kind: HeroRequestKind,
    signal: AbortSignal,
  ) {
    const stateRoute = this.routeToState(service);
    const downstreamRoute = this.routeToDownstream(service);
    await this.pulse(stateRoute, kind, kind === "heavy" ? 1900 : 1800, signal);
    const committed = this.commitState(signal);
    await this.wait(520, signal);
    await this.pulse(
      downstreamRoute,
      kind,
      kind === "heavy" ? 1450 : 1300,
      signal,
    );
    await this.react("downstream", "4", signal);
    await committed;
    return [stateRoute, downstreamRoute];
  }

  private async runManualTelemetry(routes: RouteId[], signal: AbortSignal) {
    this.manualTelemetryCount += 1;
    try {
      for (const route of routes) {
        await this.pulse(route, "telemetry", 1700, signal);
        await this.wait(220, signal);
      }
      await this.react("observe", "10", signal);
    } finally {
      this.manualTelemetryCount = Math.max(0, this.manualTelemetryCount - 1);
      this.maybeRunPendingInspection(signal);
    }
  }

  private async emitAnomaly(service: HeroServiceId, signal: AbortSignal) {
    await this.pulse(this.telemetryRoute(service), "anomaly", 1900, signal);
    const marker = this.root.querySelector<SVGElement>(
      "[data-hero-alert-marker]",
    );
    marker?.classList.add("is-visible");
    await this.wait(900, signal);
    marker?.classList.remove("is-visible");
  }

  private async runAmbientLoop(signal: AbortSignal) {
    let preferred: HeroServiceId = "3";
    await this.wait(3000, signal);
    while (!signal.aborted) {
      if (
        performance.now() < this.ambientPauseUntil ||
        this.queue.length > 0 ||
        this.manualPrimaryCount > 0 ||
        this.retryReserved ||
        this.inspectionActive
      ) {
        await this.wait(1000, signal);
        continue;
      }
      const isolated = this.model.isolatedService();
      const service =
        isolated === preferred ? (preferred === "3" ? "5" : "3") : preferred;
      await this.runAmbientTransaction(service, signal);
      preferred = preferred === "3" ? "5" : "3";
      await this.wait(8000, signal);
    }
  }

  private async runAmbientTransaction(
    service: HeroServiceId,
    signal: AbortSignal,
  ) {
    this.ambientActive = true;
    try {
      const routeToService = this.routeToService(service);
      const routeToState = this.routeToState(service);
      const routeToDownstream = this.routeToDownstream(service);
      await this.react("source", "1", signal);
      await this.pulse("1-2", "normal", 1500, signal);
      await this.react("router", "2", signal);
      await this.wait(380, signal);
      await this.pulse(routeToService, "normal", 1600, signal);
      await this.react(`service-${service}`, service, signal);
      await this.wait(450, signal);
      await this.pulse(routeToState, "normal", 1800, signal);
      const committed = this.commitState(signal);
      await this.wait(520, signal);
      await this.pulse(routeToDownstream, "normal", 1300, signal);
      await this.react("downstream", "4", signal);
      await committed;
      const telemetry = [
        "2-10" as const,
        this.telemetryRoute(service),
        "6-10" as const,
      ];
      this.lastTrace = {
        failedRoutes: [],
        kind: "normal",
        outcome: "healthy",
        routes: ["1-2", routeToService, routeToState, routeToDownstream],
        service,
        telemetry,
      };
      await this.runAmbientObservability(telemetry, signal);
    } finally {
      this.ambientActive = false;
      this.maybeRunPendingInspection(signal);
    }
  }

  private async runAmbientObservability(
    telemetry: RouteId[],
    signal: AbortSignal,
  ) {
    this.resetTrace();
    for (const [index, route] of telemetry.entries()) {
      await this.pulse(route, "telemetry", 1700, signal);
      await this.revealTraceStep(index, signal);
      if (index < telemetry.length - 1) await this.wait(500, signal);
    }
    await this.react("observe", "10", signal);
    await this.wait(2500, signal);
    await this.fadeTrace(signal);
  }

  private async runBackgroundLoop(signal: AbortSignal) {
    const rests = [14000, 20000, 17000, 22000];
    let index = 0;
    await this.wait(11000, signal);
    while (!signal.aborted) {
      if (this.canRunBackground()) await this.runBackgroundSync(signal);
      await this.wait(rests[index], signal);
      index = (index + 1) % rests.length;
    }
  }

  private canRunBackground() {
    this.model.evaluate(performance.now());
    return (
      this.model.pressure < 4 &&
      this.model.status("3") === "healthy" &&
      !this.inspectionActive &&
      !this.isStrong("3")
    );
  }

  private async runBackgroundSync(signal: AbortSignal) {
    this.root.dataset.heroBackground = "sync";
    const steps: Array<[RouteId, string | undefined]> = [
      ["1-7", "aux-7"],
      ["7-3", "aux-3"],
      ["3-8", "aux-8"],
      ["8-9", "aux-9"],
    ];
    try {
      for (const [route, reaction] of steps) {
        await this.pulse(
          route,
          "background",
          route === "8-9" ? 1550 : 1300,
          signal,
        );
        if (reaction) await this.react(reaction, undefined, signal);
        if (!this.canRunBackground()) return;
        await this.wait(240, signal);
      }
    } finally {
      delete this.root.dataset.heroBackground;
    }
  }

  private requestInspection() {
    const signal = this.abortController?.signal;
    if (!signal) return;
    if (this.inspectionActive) return;
    if (this.isOperationallyBusy()) {
      this.pendingInspectionAt ??= performance.now();
      void this.react("observe", "10", signal).catch(() => undefined);
      this.ensureMaintenanceLoop(signal);
      return;
    }
    void this.runInspection(signal);
  }

  private maybeRunPendingInspection(signal: AbortSignal) {
    if (this.pendingInspectionAt === undefined) return;
    if (performance.now() - this.pendingInspectionAt > 12000) {
      this.pendingInspectionAt = undefined;
      return;
    }
    if (!this.isOperationallyBusy()) {
      this.pendingInspectionAt = undefined;
      void this.runInspection(signal);
    }
  }

  private isOperationallyBusy() {
    return (
      this.manualPrimaryCount > 0 ||
      this.manualTelemetryCount > 0 ||
      this.ambientActive ||
      this.retryReserved
    );
  }

  private async runInspection(globalSignal: AbortSignal) {
    if (this.inspectionActive || globalSignal.aborted) return;
    this.inspectionActive = true;
    this.inspectionAbort = new AbortController();
    const signal = this.inspectionAbort.signal;
    this.root.classList.add("is-inspecting");
    const trace = this.lastTrace;
    if (trace) {
      trace.routes.forEach((route) =>
        this.routes.get(route)?.classList.add("is-inspection-route"),
      );
      trace.failedRoutes.forEach((route) =>
        this.routes.get(route)?.classList.add("is-inspection-failed"),
      );
      trace.telemetry.forEach((route) =>
        this.routes.get(route)?.classList.add("is-inspection-telemetry"),
      );
      this.root
        .querySelectorAll<SVGElement>("[data-hero-trace-span]")
        .forEach((span) => span.classList.add("is-visible"));
    }
    try {
      await this.react("observe", "10", signal);
      await this.wait(trace ? 3000 : 2600, signal);
    } catch {
      /* Source actions and resets cancel inspection immediately. */
    } finally {
      if (this.inspectionAbort?.signal === signal) this.endInspection();
    }
  }

  private endInspection() {
    this.inspectionAbort?.abort();
    this.inspectionAbort = undefined;
    this.inspectionActive = false;
    this.root.classList.remove("is-inspecting");
    this.root
      .querySelectorAll(
        ".is-inspection-route, .is-inspection-failed, .is-inspection-telemetry",
      )
      .forEach((element) =>
        element.classList.remove(
          "is-inspection-route",
          "is-inspection-failed",
          "is-inspection-telemetry",
        ),
      );
    this.resetTrace();
  }

  private ensureMaintenanceLoop(signal: AbortSignal) {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    void this.runMaintenanceLoop(signal)
      .catch(() => undefined)
      .finally(() => {
        this.maintenanceRunning = false;
      });
  }

  private async runMaintenanceLoop(signal: AbortSignal) {
    while (!signal.aborted) {
      const now = performance.now();
      this.model.evaluate(now);
      this.updateServiceVisuals();
      this.updateQueueMarkers();
      this.maybeRunPendingInspection(signal);

      const isolated = this.model.isolatedService();
      if (
        isolated &&
        !this.probeRunning &&
        this.model.canBeginRecovery(isolated, this.queue.length, now)
      )
        await this.runRecoveryProbe(isolated, signal);

      if (
        !this.model.isolatedService() &&
        this.queue.length === 0 &&
        this.pendingInspectionAt === undefined &&
        this.model.isCalm(performance.now())
      )
        return;
      await this.wait(750, signal);
    }
  }

  private async runRecoveryProbe(service: HeroServiceId, signal: AbortSignal) {
    if (!this.model.beginRecovery(service)) return;
    this.probeRunning = true;
    this.updateServiceVisuals();
    try {
      await this.pulse(this.routeToService(service), "probe", 1050, signal);
      if (this.model.shouldAbortProbe(performance.now())) {
        this.model.abortRecovery(service);
        return;
      }
      await this.wait(320, signal);
      await this.pulse(
        this.routeToService(service),
        "probe",
        1050,
        signal,
        true,
      );
      if (this.model.shouldAbortProbe(performance.now())) {
        this.model.abortRecovery(service);
        return;
      }
      this.model.recover(service, performance.now());
      void this.pumpQueue(signal);
    } finally {
      this.probeRunning = false;
      this.updateServiceVisuals();
    }
  }

  private updateServiceVisuals() {
    (["3", "5"] as const).forEach((service) => {
      const status = this.model.status(service);
      const state = this.root.querySelector<SVGElement>(
        `[data-hero-service-state="${service}"]`,
      );
      if (state) state.dataset.heroStatus = status;
      const route = this.routes.get(this.routeToService(service));
      route?.classList.toggle(
        "is-unavailable",
        status === "open" || status === "recovering",
      );
      route?.classList.toggle("is-degraded", status === "degraded");
    });
  }

  private updateQueueMarkers() {
    const visible = Math.min(3, this.queue.length);
    const warn = this.model.pressure >= 4;
    this.root
      .querySelectorAll<SVGElement>("[data-hero-queue-marker]")
      .forEach((marker, index) => {
        marker.classList.toggle("is-visible", index < visible);
        marker.classList.toggle("is-warn", warn && index < visible);
      });
  }

  private showNeighborhood(node: string) {
    if (!node || !this.canRun()) return;
    const relatedNodes = new Set([node]);
    this.root
      .querySelectorAll<SVGPathElement>("[data-hero-connects]")
      .forEach((route) => {
        const endpoints = route.dataset.heroConnects?.split(" ") ?? [];
        const related = endpoints.includes(node);
        route.classList.toggle("is-neighborhood-route", related);
        route.classList.toggle("is-neighborhood-muted", !related);
        if (related)
          endpoints.forEach((endpoint) => relatedNodes.add(endpoint));
      });
    this.root
      .querySelectorAll<SVGElement>("[data-hero-node]")
      .forEach((item) => {
        const id = item.dataset.heroNode ?? "";
        item.classList.toggle("is-neighborhood-node", relatedNodes.has(id));
        item.classList.toggle("is-neighborhood-focus", id === node);
        item.classList.toggle("is-neighborhood-muted", !relatedNodes.has(id));
      });
    this.root.classList.add("has-neighborhood");
  }

  private clearNeighborhood() {
    this.root.classList.remove("has-neighborhood");
    this.root
      .querySelectorAll(
        ".is-neighborhood-route, .is-neighborhood-node, .is-neighborhood-focus, .is-neighborhood-muted",
      )
      .forEach((element) =>
        element.classList.remove(
          "is-neighborhood-route",
          "is-neighborhood-node",
          "is-neighborhood-focus",
          "is-neighborhood-muted",
        ),
      );
  }

  private async commitState(signal: AbortSignal) {
    this.persistenceUntil = Math.max(
      this.persistenceUntil,
      performance.now() + 1400,
    );
    const element = this.root.querySelector<SVGElement>(
      '[data-hero-reaction="persistence"]',
    );
    element?.classList.add("is-committed");
    if (this.persistenceTask) return this.persistenceTask;
    this.persistenceTask = (async () => {
      try {
        while (performance.now() < this.persistenceUntil)
          await this.wait(
            Math.min(350, this.persistenceUntil - performance.now()),
            signal,
          );
      } finally {
        element?.classList.remove("is-committed");
        this.persistenceTask = undefined;
        this.persistenceUntil = 0;
      }
    })();
    return this.persistenceTask;
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
    variant?: string,
  ) {
    const existing = this.reactionLocks.get(reaction);
    if (existing) return existing;
    const task = this.runReaction(reaction, strongNode, signal, variant);
    this.reactionLocks.set(reaction, task);
    try {
      await task;
    } finally {
      if (this.reactionLocks.get(reaction) === task)
        this.reactionLocks.delete(reaction);
    }
  }

  private async runReaction(
    reaction: string,
    strongNode: string | undefined,
    signal: AbortSignal,
    variant?: string,
  ) {
    const element = this.root.querySelector<SVGElement>(
      `[data-hero-reaction="${reaction}"]`,
    );
    if (!element) return;
    if (strongNode) this.addStrong(strongNode);
    if (variant) element.classList.add(variant);
    try {
      await this.playClassAnimation(element, "is-active", signal);
    } finally {
      if (variant) element.classList.remove(variant);
      if (strongNode) this.removeStrong(strongNode);
    }
  }

  private addStrong(node: string) {
    this.strongNodes.set(node, (this.strongNodes.get(node) ?? 0) + 1);
  }

  private removeStrong(node: string) {
    const next = (this.strongNodes.get(node) ?? 1) - 1;
    if (next <= 0) this.strongNodes.delete(node);
    else this.strongNodes.set(node, next);
  }

  private isStrong(node: string) {
    return (this.strongNodes.get(node) ?? 0) > 0;
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
    const template = this.pulseTemplates.get(kind);
    const pathData = route?.getAttribute("d");
    if (!template || !this.pulseLayer || !pathData) return;

    const pulse = template.cloneNode(true) as SVGGraphicsElement;
    pulse.removeAttribute("data-hero-pulse-template");
    pulse.dataset.heroPulseInstance = kind;
    pulse.style.setProperty("offset-path", `path("${pathData}")`);
    pulse.style.setProperty("offset-rotate", reverse ? "auto 180deg" : "auto");
    this.pulseLayer.append(pulse);
    this.pulseInstances.add(pulse);

    const start = reverse ? "100%" : "0%";
    const end = reverse ? "0%" : "100%";
    const peakOpacity =
      kind === "background"
        ? 0.56
        : kind === "probe"
          ? 0.62
          : kind === "telemetry"
            ? 0.78
            : 0.94;
    const animation = pulse.animate(
      [
        { offsetDistance: start, opacity: 0, offset: 0 },
        { offsetDistance: start, opacity: peakOpacity * 0.22, offset: 0.08 },
        { opacity: peakOpacity, offset: 0.2 },
        { offsetDistance: end, opacity: peakOpacity, offset: 0.92 },
        { offsetDistance: end, opacity: 0, offset: 1 },
      ],
      {
        duration,
        easing: "cubic-bezier(0.28, 0.05, 0.3, 1)",
      },
    );
    try {
      await this.trackAnimation(animation, signal);
    } finally {
      this.pulseInstances.delete(pulse);
      pulse.remove();
    }
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
    animations.forEach((animation) => this.animations.add(animation));
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

  private wait(milliseconds: number, signal: AbortSignal) {
    this.throwIfAborted(signal);
    return new Promise<void>((resolve, reject) => {
      const handleAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      const timer = window.setTimeout(
        () => {
          signal.removeEventListener("abort", handleAbort);
          resolve();
        },
        Math.max(0, milliseconds),
      );
      signal.addEventListener("abort", handleAbort, { once: true });
    });
  }

  private throwIfAborted(signal: AbortSignal) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  private routeToService(service: HeroServiceId): RouteId {
    return service === "3" ? "2-3" : "2-5";
  }

  private routeToState(service: HeroServiceId): RouteId {
    return service === "3" ? "3-6" : "5-6";
  }

  private routeToDownstream(service: HeroServiceId): RouteId {
    return service === "3" ? "3-4" : "5-4";
  }

  private telemetryRoute(service: HeroServiceId): RouteId {
    return service === "3" ? "3-10" : "5-10";
  }

  private resetVisualState() {
    this.animations.forEach((animation) => animation.cancel());
    this.animations.clear();
    this.pulseInstances.forEach((pulse) => pulse.remove());
    this.pulseInstances.clear();
    this.strongNodes.clear();
    this.reactionLocks.clear();
    delete this.root.dataset.heroBackground;
    this.root.classList.remove("is-inspecting", "has-neighborhood");
    this.root
      .querySelectorAll<SVGElement>(
        ".is-active, .is-visible, .is-drawing, .is-fading, .is-heavy, .is-warn, .is-alert, .is-committed, .is-faulting, .is-unavailable, .is-degraded, .is-inspection-route, .is-inspection-failed, .is-inspection-telemetry, .is-neighborhood-route, .is-neighborhood-node, .is-neighborhood-focus, .is-neighborhood-muted",
      )
      .forEach((element) => {
        element.removeAttribute("data-hero-status");
        element.classList.remove(
          "is-active",
          "is-visible",
          "is-drawing",
          "is-fading",
          "is-heavy",
          "is-warn",
          "is-alert",
          "is-committed",
          "is-faulting",
          "is-unavailable",
          "is-degraded",
          "is-inspection-route",
          "is-inspection-failed",
          "is-inspection-telemetry",
          "is-neighborhood-route",
          "is-neighborhood-node",
          "is-neighborhood-focus",
          "is-neighborhood-muted",
        );
      });
    this.root
      .querySelectorAll<SVGElement>("[data-hero-service-state]")
      .forEach((state) => (state.dataset.heroStatus = "healthy"));
    this.updateQueueMarkers();
    this.resetTrace();
  }
}

export function initHeroSystem() {
  const root = document.querySelector<SVGSVGElement>("[data-hero-system]");
  if (!root) return;
  new HeroSystemController(root).init();
}
