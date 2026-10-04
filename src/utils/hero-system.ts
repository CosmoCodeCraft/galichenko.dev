import {
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
  stages: TraceStage[];
}

interface TraceStage {
  end?: number;
  name: "accepted" | "router" | "processing" | "persistence" | "downstream" | "failure" | "feedback" | "retry" | "complete";
  start: number;
  tone?: "normal" | "heavy" | "alert";
}

interface RetryWaiter {
  cleanup: () => void;
  service: HeroServiceId;
  settle: (reserved: boolean) => void;
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
const MAX_ACTIVE_PULSES = 12;
const SOURCE_GATE_MS = 100;
const FEEDBACK_GATE_MS = 250;
const MANUAL_TRACE_OWNERSHIP_MS = 12000;

class HeroSystemController {
  private readonly routes = new Map<RouteId, SVGPathElement>();
  private readonly pulseTemplates = new Map<PulseKind, SVGGraphicsElement>();
  private readonly animations = new Set<Animation>();
  private readonly pulseInstances = new Set<SVGGraphicsElement>();
  private readonly pulseAnimations = new Map<SVGGraphicsElement, Animation>();
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
  private retryWaiter?: RetryWaiter;
  private readonly telemetryPending = new Set<RouteId>();
  private telemetryWeight = 0;
  private telemetryWorker?: Promise<void>;
  private telemetryLastAt = Number.NEGATIVE_INFINITY;
  private sourceGateUntil = 0;
  private feedbackGateUntil = 0;
  private manualTraceOwnershipUntil = 0;
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
    this.retryWaiter?.cleanup();
    this.retryWaiter = undefined;
    this.maintenanceRunning = false;
    this.probeRunning = false;
    this.pendingInspectionAt = undefined;
    this.telemetryPending.clear();
    this.telemetryWeight = 0;
    this.telemetryWorker = undefined;
    this.telemetryLastAt = Number.NEGATIVE_INFINITY;
    this.sourceGateUntil = 0;
    this.feedbackGateUntil = 0;
    this.manualTraceOwnershipUntil = 0;
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
    source?.addEventListener("focus", () => {
      this.showNeighborhood("1");
      this.setFocusRing("source", true);
    });
    source?.addEventListener("blur", () => {
      this.clearNeighborhood();
      this.setFocusRing("source", false);
    });

    const observe = this.actionControl("observe");
    observe?.addEventListener("click", this.handleObserveClick);
    observe?.addEventListener("keydown", this.handleObserveKeyDown);
    observe?.addEventListener("focus", () => {
      this.showNeighborhood("10");
      this.setFocusRing("observe", true);
    });
    observe?.addEventListener("blur", () => {
      this.clearNeighborhood();
      this.setFocusRing("observe", false);
    });
  }

  private actionControl(action: "source" | "observe") {
    return this.root.querySelector<SVGGraphicsElement>(
      `[data-hero-action="${action}"]`,
    );
  }

  private setFocusRing(action: "source" | "observe", visible: boolean) {
    this.root
      .querySelector(`[data-hero-focus-ring="${action}"]`)
      ?.classList.toggle("is-visible", visible);
  }

  private readonly handleSourcePointerDown = (event: PointerEvent) => {
    if (!this.canRun() || event.button !== 0 || this.hold) return;
    const source = event.currentTarget as SVGGraphicsElement;
    event.preventDefault();
    this.setFocusRing("source", false);
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
    source.blur();
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
    if (event.detail > 0) {
      (event.currentTarget as SVGGraphicsElement).blur();
      this.setFocusRing("observe", false);
    }
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
    const now = performance.now();
    if (now < this.sourceGateUntil) return;
    this.sourceGateUntil = now + SOURCE_GATE_MS;
    this.endInspection();
    this.pendingInspectionAt = undefined;
    const signal = this.abortController?.signal;
    if (!signal) return;
    const accepted = this.queue.length < this.model.admissionCapacity(now);
    this.model.recordSource(kind, accepted, now);
    this.ambientPauseUntil = now + 12000;
    this.ensureMaintenanceLoop(signal);

    if (!accepted) {
      if (now >= this.feedbackGateUntil) {
        this.feedbackGateUntil = now + FEEDBACK_GATE_MS;
        void this.react("rate-limit", undefined, signal, "is-warn").catch(
          () => undefined,
        );
      }
      this.updateServiceVisuals();
      return;
    }

    this.queue.push({ id: ++this.requestId, kind });
    this.manualTraceOwnershipUntil = now + MANUAL_TRACE_OWNERSHIP_MS;
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
          this.releaseService(service);
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
    const startedAt = performance.now();
    const elapsed = () => performance.now() - startedAt;
    const stages: TraceStage[] = [{ name: "accepted", start: 0 }];
    const successfulRoutes: RouteId[] = ["1-2"];
    let service = initialService;
    let failedService: HeroServiceId | undefined;
    let failedRoutes: RouteId[] = [];

    await this.pulse("1-2", request.kind, 1500, signal);
    stages.push({ name: "router", start: elapsed() });
    await this.react("router", "2", signal);
    await this.wait(380, signal);
    const firstServiceRoute = this.routeToService(service);
    successfulRoutes.push(firstServiceRoute);
    const processingStage: TraceStage = {
      name: "processing",
      start: elapsed(),
      tone: request.kind === "heavy" ? "heavy" : "normal",
    };
    stages.push(processingStage);
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
    processingStage.end = elapsed();

    if (assignment.shouldTrip) {
      processingStage.tone = "alert";
      failedService = service;
      failedRoutes = [firstServiceRoute, this.telemetryRoute(service)];
      const retryService = await this.failAndRetry(
        service,
        request.kind,
        signal,
        stages,
        elapsed,
      );
      if (!retryService) {
        this.retryReserved = false;
        this.manualTraceOwnershipUntil = performance.now() + MANUAL_TRACE_OWNERSHIP_MS;
        void this.pumpQueue(signal);
        return;
      }
      service = retryService;
      successfulRoutes.push(this.routeToService(service));
    } else {
      this.releaseService(service);
      void this.pumpQueue(signal);
    }

    stages.push({ name: "persistence", start: elapsed() });
    const completionRoutes = await this.completeTransaction(
      service,
      request.kind,
      signal,
    );
    successfulRoutes.push(...completionRoutes);
    stages.push({ name: "downstream", start: elapsed() - 1300 });
    stages.push({ name: "complete", start: elapsed() });
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
      stages,
    };
    this.manualTraceOwnershipUntil = performance.now() + MANUAL_TRACE_OWNERSHIP_MS;
    this.retryReserved = false;
    void this.pumpQueue(signal);
    this.queueTelemetry(telemetry, signal, request.kind === "heavy" ? 2 : 1);
  }

  private async failAndRetry(
    failed: HeroServiceId,
    kind: HeroRequestKind,
    signal: AbortSignal,
    stages: TraceStage[],
    elapsed: () => number,
  ): Promise<HeroServiceId | undefined> {
    const failedState = this.root.querySelector<SVGElement>(
      `[data-hero-service-state="${failed}"]`,
    );
    failedState?.classList.add("is-faulting");
    stages.push({ name: "failure", start: elapsed(), tone: "alert" });
    const anomaly = this.emitAnomaly(failed, signal);
    await this.wait(180, signal);
    await this.pulse(
      this.routeToService(failed),
      "feedback",
      1400,
      signal,
      true,
    );
    stages.push({ name: "feedback", start: elapsed(), tone: "alert" });
    await this.react("router", "2", signal, "is-alert");
    if (!this.model.open(failed, performance.now())) {
      this.model.releaseTripClaim(failed);
      this.releaseService(failed);
      failedState?.classList.remove("is-faulting");
      return;
    }
    this.updateServiceVisuals();
    await anomaly;
    failedState?.classList.remove("is-faulting");

    const peer: HeroServiceId = failed === "3" ? "5" : "3";
    if (!(await this.waitForRetrySlot(peer, signal))) return;

    await this.wait(320, signal);
    const retryStage: TraceStage = {
      name: "retry",
      start: elapsed(),
      tone: "normal",
    };
    stages.push(retryStage);
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
    retryStage.end = elapsed();
    this.releaseService(peer);
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

  private releaseService(service: HeroServiceId) {
    this.model.release(service, performance.now());
    this.wakeRetryWaiter();
  }

  private waitForRetrySlot(service: HeroServiceId, signal: AbortSignal) {
    if (this.model.reserve(service)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (reserved: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.retryWaiter?.settle === finish) this.retryWaiter = undefined;
        resolve(reserved);
      };
      const timeout = window.setTimeout(() => finish(false), 6000);
      const abort = () => finish(false);
      const cleanup = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      };
      signal.addEventListener("abort", abort, { once: true });
      this.retryWaiter = { cleanup, service, settle: finish };
    });
  }

  private wakeRetryWaiter() {
    const waiter = this.retryWaiter;
    if (!waiter || !this.model.reserve(waiter.service)) return;
    waiter.settle(true);
  }

  private queueTelemetry(
    routes: RouteId[],
    signal: AbortSignal,
    weight = 1,
  ) {
    routes.forEach((route) => this.telemetryPending.add(route));
    this.telemetryWeight = Math.min(9, this.telemetryWeight + weight);
    this.telemetryLastAt = performance.now();
    if (this.telemetryWorker) return;
    this.telemetryWorker = this.runTelemetryWorker(signal)
      .catch(() => undefined)
      .finally(() => {
        this.telemetryWorker = undefined;
        this.manualTelemetryCount = 0;
        this.clearTelemetryActivity();
        this.maybeRunPendingInspection(signal);
        if (this.telemetryPending.size > 0 && !signal.aborted)
          this.queueTelemetry([], signal, 0);
      });
  }

  private async runTelemetryWorker(signal: AbortSignal) {
    this.manualTelemetryCount = 1;
    while (this.telemetryPending.size > 0) {
      await this.wait(200, signal);
      const routes = [...this.telemetryPending];
      const weight = this.telemetryWeight;
      this.telemetryPending.clear();
      this.telemetryWeight = 0;
      this.showTelemetryActivity(Math.min(3, Math.max(1, weight)));
      for (const route of routes) {
        await this.pulse(route, "telemetry", 1600, signal);
        await this.wait(180, signal);
      }
      await this.react(
        "observe",
        "10",
        signal,
        weight >= 3 ? "is-busy" : undefined,
      );
    }
    this.telemetryLastAt = performance.now();
  }

  private showTelemetryActivity(count: number) {
    this.root
      .querySelectorAll<SVGElement>("[data-hero-marker]")
      .forEach((marker, index) =>
        marker.classList.toggle("is-visible", index < count),
      );
  }

  private clearTelemetryActivity() {
    this.root
      .querySelectorAll<SVGElement>("[data-hero-marker]")
      .forEach((marker) => marker.classList.remove("is-visible"));
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
    const startedAt = performance.now();
    const elapsed = () => performance.now() - startedAt;
    const stages: TraceStage[] = [{ name: "accepted", start: 0 }];
    try {
      const routeToService = this.routeToService(service);
      const routeToState = this.routeToState(service);
      const routeToDownstream = this.routeToDownstream(service);
      await this.react("source", "1", signal);
      await this.pulse("1-2", "normal", 1500, signal);
      stages.push({ name: "router", start: elapsed() });
      await this.react("router", "2", signal);
      await this.wait(380, signal);
      const processing: TraceStage = {
        name: "processing",
        start: elapsed(),
        tone: "normal",
      };
      stages.push(processing);
      await this.pulse(routeToService, "normal", 1600, signal);
      await this.react(`service-${service}`, service, signal);
      await this.wait(450, signal);
      processing.end = elapsed();
      stages.push({ name: "persistence", start: elapsed() });
      await this.pulse(routeToState, "normal", 1800, signal);
      const committed = this.commitState(signal);
      await this.wait(520, signal);
      await this.pulse(routeToDownstream, "normal", 1300, signal);
      await this.react("downstream", "4", signal);
      await committed;
      stages.push({ name: "downstream", start: elapsed() - 1300 });
      stages.push({ name: "complete", start: elapsed() });
      const telemetry = [
        "2-10" as const,
        this.telemetryRoute(service),
        "6-10" as const,
      ];
      if (
        performance.now() >= this.manualTraceOwnershipUntil &&
        this.manualPrimaryCount === 0 &&
        this.queue.length === 0
      ) {
        this.lastTrace = {
          failedRoutes: [],
          kind: "normal",
          outcome: "healthy",
          routes: ["1-2", routeToService, routeToState, routeToDownstream],
          service,
          telemetry,
          stages,
        };
      }
      this.queueTelemetry(telemetry, signal);
    } finally {
      this.ambientActive = false;
      this.maybeRunPendingInspection(signal);
    }
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
      this.pulseInstances.size < MAX_ACTIVE_PULSES &&
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
    if (this.isOperationallyBusy() || !this.telemetryIsSettled()) {
      this.pendingInspectionAt ??= performance.now();
      void this.react("observe", "10", signal).catch(() => undefined);
      this.ensureMaintenanceLoop(signal);
      return;
    }
    void this.runInspection(signal);
  }

  private maybeRunPendingInspection(signal: AbortSignal) {
    if (this.pendingInspectionAt === undefined) return;
    if (performance.now() - this.pendingInspectionAt > 10000) {
      this.pendingInspectionAt = undefined;
      return;
    }
    if (!this.isOperationallyBusy() && this.telemetryIsSettled()) {
      this.pendingInspectionAt = undefined;
      void this.runInspection(signal);
    }
  }

  private telemetryIsSettled() {
    return (
      !this.telemetryWorker &&
      this.telemetryPending.size === 0 &&
      performance.now() - this.telemetryLastAt >= 1000
    );
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
    const trace = this.lastTrace
      ? {
          ...this.lastTrace,
          failedRoutes: [...this.lastTrace.failedRoutes],
          routes: [...this.lastTrace.routes],
          telemetry: [...this.lastTrace.telemetry],
          stages: this.lastTrace.stages.map((stage) => ({ ...stage })),
        }
      : undefined;
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
      this.renderTraceWaterfall(trace);
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

  private renderTraceWaterfall(trace: LastTrace) {
    const stages = trace.stages.slice(-6);
    const total = Math.max(
      1,
      ...stages.map((stage) => stage.end ?? stage.start),
    );
    const startX = 356;
    const width = 66;
    this.root
      .querySelectorAll<SVGLineElement>("[data-hero-trace-span]")
      .forEach((span, index) => {
        const stage = stages[index];
        if (!stage) return;
        const x1 = startX + (stage.start / total) * width;
        const duration = Math.max(
          5,
          (((stage.end ?? stage.start + total * 0.08) - stage.start) / total) *
            width,
        );
        span.setAttribute("x1", x1.toFixed(1));
        span.setAttribute(
          "x2",
          Math.min(startX + width, x1 + duration).toFixed(1),
        );
        span.classList.toggle("is-heavy", stage.tone === "heavy");
        span.classList.toggle("is-alert", stage.tone === "alert");
        span.classList.add("is-visible");
      });
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

  private resetTrace() {
    this.root
      .querySelectorAll<SVGElement>(
        "[data-hero-trace-span], [data-hero-marker]",
      )
      .forEach((element) =>
        element.classList.remove("is-visible", "is-drawing", "is-heavy", "is-alert"),
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
    if (
      kind === "telemetry" &&
      [...this.pulseInstances].some(
        (instance) => instance.dataset.heroPulseRoute === routeId,
      )
    )
      return;
    if (!this.ensurePulseCapacity(kind)) return;
    const route = this.routes.get(routeId);
    const template = this.pulseTemplates.get(kind);
    const pathData = route?.getAttribute("d");
    if (!template || !this.pulseLayer || !pathData) return;

    const pulse = template.cloneNode(true) as SVGGraphicsElement;
    pulse.removeAttribute("data-hero-pulse-template");
    pulse.dataset.heroPulseInstance = kind;
    pulse.dataset.heroPulseRoute = routeId;
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
    this.pulseAnimations.set(pulse, animation);
    try {
      await this.trackAnimation(animation, signal);
    } finally {
      this.pulseAnimations.delete(pulse);
      this.pulseInstances.delete(pulse);
      pulse.remove();
    }
  }

  private ensurePulseCapacity(kind: PulseKind) {
    if (this.pulseInstances.size < MAX_ACTIVE_PULSES) return true;
    const priority = this.pulsePriority(kind);
    const victim = [...this.pulseInstances].find((instance) => {
      const activeKind = instance.dataset.heroPulseInstance as PulseKind;
      return this.pulsePriority(activeKind) < priority;
    });
    if (!victim) return false;
    this.pulseAnimations.get(victim)?.cancel();
    this.pulseAnimations.delete(victim);
    this.pulseInstances.delete(victim);
    victim.remove();
    return true;
  }

  private pulsePriority(kind: PulseKind) {
    if (kind === "anomaly" || kind === "feedback" || kind === "probe") return 4;
    if (kind === "normal" || kind === "heavy") return 3;
    if (kind === "telemetry") return 2;
    return 1;
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
    this.pulseAnimations.clear();
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
