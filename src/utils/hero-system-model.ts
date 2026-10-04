export type HeroRequestKind = "normal" | "heavy";
export type HeroServiceId = "3" | "5";
export type HeroServiceStatus = "healthy" | "degraded" | "open" | "recovering";

export const HERO_QUEUE_CAPACITY = 4;

const PRESSURE_MAX = 20;
const STRESS_MAX = 12;
const PRESSURE_DECAY_DELAY = 1500;
const PRESSURE_DECAY_RATE = 0.7 / 1000;
const STRESS_DECAY_RATE = 0.45 / 1000;
const DEGRADED_AT = 3.5;
const HEALTHY_BELOW = 2;
const TRIP_STRESS = 5.5;
const TRIP_PRESSURE = 7.5;
const MINIMUM_OPEN_TIME = 6000;
const RECOVERY_STABLE_TIME = 3000;
const RECOVERY_PRESSURE = 2.5;
const PROBE_ABORT_PRESSURE = 4;
const BREAKER_GRACE = 30000;

interface ServiceModel {
  busy: boolean;
  graceUntil: number;
  openedAt: number;
  recoveryStableSince?: number;
  status: HeroServiceStatus;
  stress: number;
}

export interface ServiceAssignment {
  shouldTrip: boolean;
  stress: number;
}

export class HeroSystemModel {
  pressure = 0;
  private lastDecayAt = 0;
  private lastSourceAt = Number.NEGATIVE_INFINITY;
  private nextTie: HeroServiceId = "3";
  private readonly services: Record<HeroServiceId, ServiceModel> = {
    "3": {
      busy: false,
      graceUntil: 0,
      openedAt: 0,
      status: "healthy",
      stress: 0,
    },
    "5": {
      busy: false,
      graceUntil: 0,
      openedAt: 0,
      status: "healthy",
      stress: 0,
    },
  };

  reset(now: number) {
    this.pressure = 0;
    this.lastDecayAt = now;
    this.lastSourceAt = Number.NEGATIVE_INFINITY;
    this.nextTie = "3";
    for (const service of Object.values(this.services)) {
      service.busy = false;
      service.graceUntil = 0;
      service.openedAt = 0;
      service.recoveryStableSince = undefined;
      service.status = "healthy";
      service.stress = 0;
    }
  }

  recordSource(kind: HeroRequestKind, accepted: boolean, now: number) {
    this.evaluate(now);
    const increment = accepted
      ? kind === "heavy"
        ? 2.5
        : 1
      : kind === "heavy"
        ? 0.5
        : 0.25;
    this.pressure = Math.min(PRESSURE_MAX, this.pressure + increment);
    this.lastSourceAt = now;
    this.lastDecayAt = now;
  }

  evaluate(now: number) {
    if (this.lastDecayAt === 0) this.lastDecayAt = now;
    const elapsed = Math.max(0, now - this.lastDecayAt);
    const pressureDecayStart = Math.max(
      this.lastDecayAt,
      this.lastSourceAt + PRESSURE_DECAY_DELAY,
    );
    if (now > pressureDecayStart) {
      this.pressure = Math.max(
        0,
        this.pressure - (now - pressureDecayStart) * PRESSURE_DECAY_RATE,
      );
    }
    for (const service of Object.values(this.services)) {
      if (!service.busy)
        service.stress = Math.max(
          0,
          service.stress - elapsed * STRESS_DECAY_RATE,
        );
      if (service.status === "healthy" && service.stress >= DEGRADED_AT)
        service.status = "degraded";
      else if (service.status === "degraded" && service.stress < HEALTHY_BELOW)
        service.status = "healthy";
    }
    this.lastDecayAt = now;
  }

  chooseService(now: number): HeroServiceId | undefined {
    this.evaluate(now);
    const available = (["3", "5"] as const).filter((id) => {
      const service = this.services[id];
      return (
        !service.busy &&
        service.status !== "open" &&
        service.status !== "recovering"
      );
    });
    if (available.length === 0) return;
    if (available.length === 1) return available[0];

    const [first, second] = available;
    const firstService = this.services[first];
    const secondService = this.services[second];
    if (firstService.status !== secondService.status)
      return firstService.status === "healthy" ? first : second;
    if (Math.abs(firstService.stress - secondService.stress) > 0.2)
      return firstService.stress < secondService.stress ? first : second;

    const selected = this.nextTie;
    this.nextTie = selected === "3" ? "5" : "3";
    return selected;
  }

  assign(
    id: HeroServiceId,
    kind: HeroRequestKind,
    now: number,
  ): ServiceAssignment {
    this.evaluate(now);
    const service = this.services[id];
    const wasDegraded = service.status === "degraded";
    service.busy = true;
    service.stress = Math.min(
      STRESS_MAX,
      service.stress + (kind === "heavy" ? 3 : 1),
    );
    if (service.status === "healthy" && service.stress >= DEGRADED_AT)
      service.status = "degraded";

    const peer = this.services[id === "3" ? "5" : "3"];
    return {
      shouldTrip:
        wasDegraded &&
        service.stress >= TRIP_STRESS &&
        this.pressure >= TRIP_PRESSURE &&
        peer.status !== "open" &&
        peer.status !== "recovering" &&
        now >= service.graceUntil,
      stress: service.stress,
    };
  }

  reserve(id: HeroServiceId) {
    const service = this.services[id];
    if (
      service.busy ||
      service.status === "open" ||
      service.status === "recovering"
    )
      return false;
    service.busy = true;
    return true;
  }

  release(id: HeroServiceId, now: number) {
    this.evaluate(now);
    this.services[id].busy = false;
  }

  open(id: HeroServiceId, now: number) {
    this.evaluate(now);
    const peer = this.services[id === "3" ? "5" : "3"];
    if (peer.status === "open" || peer.status === "recovering") return false;
    const service = this.services[id];
    service.busy = false;
    service.openedAt = now;
    service.recoveryStableSince = undefined;
    service.status = "open";
    return true;
  }

  canBeginRecovery(id: HeroServiceId, queueLength: number, now: number) {
    this.evaluate(now);
    const service = this.services[id];
    const peer = this.services[id === "3" ? "5" : "3"];
    const safe =
      service.status === "open" &&
      now - service.openedAt >= MINIMUM_OPEN_TIME &&
      this.pressure <= RECOVERY_PRESSURE &&
      queueLength === 0 &&
      !peer.busy &&
      peer.stress < DEGRADED_AT;
    if (!safe) {
      service.recoveryStableSince = undefined;
      return false;
    }
    service.recoveryStableSince ??= now;
    return now - service.recoveryStableSince >= RECOVERY_STABLE_TIME;
  }

  beginRecovery(id: HeroServiceId) {
    const service = this.services[id];
    if (service.status !== "open") return false;
    service.status = "recovering";
    service.recoveryStableSince = undefined;
    return true;
  }

  shouldAbortProbe(now: number) {
    this.evaluate(now);
    return this.pressure > PROBE_ABORT_PRESSURE;
  }

  abortRecovery(id: HeroServiceId) {
    const service = this.services[id];
    if (service.status === "recovering") service.status = "open";
    service.recoveryStableSince = undefined;
  }

  recover(id: HeroServiceId, now: number) {
    const service = this.services[id];
    service.status = "healthy";
    service.stress = 0;
    service.openedAt = 0;
    service.recoveryStableSince = undefined;
    service.graceUntil = now + BREAKER_GRACE;
  }

  status(id: HeroServiceId) {
    return this.services[id].status;
  }

  stress(id: HeroServiceId) {
    return this.services[id].stress;
  }

  isBusy(id: HeroServiceId) {
    return this.services[id].busy;
  }

  isolatedService(): HeroServiceId | undefined {
    return (["3", "5"] as const).find((id) => {
      const status = this.services[id].status;
      return status === "open" || status === "recovering";
    });
  }

  isCalm(now: number) {
    this.evaluate(now);
    return (
      this.pressure === 0 &&
      (["3", "5"] as const).every(
        (id) =>
          this.services[id].stress === 0 &&
          this.services[id].status === "healthy" &&
          !this.services[id].busy,
      )
    );
  }
}
