/**
 * Simulation Engine — replays a pre-recorded interview in real time.
 *
 * It merges all events from meeting.json + transcript.json into a single
 * sorted timeline, then ticks through them at a configurable speed.
 *
 * Consumers subscribe via `onEvent` and receive each event as the
 * simulated clock reaches its timestamp.
 */

// ─── Type Definitions ───────────────────────────────────────────────

export interface Participant {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  joinTime: number;
  leaveTime: number | null;
  webcamOn: boolean;
  screenShare: boolean;
  nameChanges: { time: number; newName: string }[];
}

export interface CalendarData {
  candidateName: string;
  candidateEmail: string;
  interviewerNames: string[];
}

export interface MeetingEventData {
  displayName?: string;
  oldName?: string;
  newName?: string;
  durationMs?: number;
  active?: boolean;
}

export interface MeetingEvent {
  time: number;
  type:
    | "join"
    | "leave"
    | "webcam_on"
    | "webcam_off"
    | "speaking"
    | "name_change"
    | "screen_share";
  participantId: string;
  data: MeetingEventData;
}

export interface TranscriptLine {
  time: number;
  speaker: string;
  text: string;
}

export interface MeetingData {
  meetingId: string;
  platform: string;
  scheduledStart: string;
  events: MeetingEvent[];
}

// ─── Unified Timeline Event ─────────────────────────────────────────

export type TimelineEventType = MeetingEvent["type"] | "transcript";

export interface TimelineEvent {
  /** Seconds into the meeting */
  time: number;
  /** The kind of event */
  type: TimelineEventType;
  /** Which participant triggered this event */
  participantId: string;
  /** Payload — varies by type */
  data: MeetingEventData & { text?: string };
}

// ─── Simulation State ───────────────────────────────────────────────

export interface SimulationState {
  /** Current simulation clock (seconds) */
  currentTime: number;
  /** True while the simulation is actively ticking */
  isRunning: boolean;
  /** All events that have already fired */
  firedEvents: TimelineEvent[];
  /** Participant map keyed by ID, updated live */
  participants: Record<string, Participant>;
  /** Calendar / external metadata */
  calendar: CalendarData;
  /** The complete pre-built timeline (readonly reference) */
  timeline: TimelineEvent[];
  /** Total duration of the simulation in seconds */
  totalDuration: number;
}

export type SimulationEventCallback = (
  event: TimelineEvent,
  state: SimulationState
) => void;

// ─── Simulation Engine ──────────────────────────────────────────────

export class SimulationEngine {
  private timeline: TimelineEvent[] = [];
  private participants: Record<string, Participant> = {};
  private manualOverrides: Record<string, Partial<Participant>> = {};
  private calendar: CalendarData = {
    candidateName: "",
    candidateEmail: "",
    interviewerNames: [],
  };

  private currentTime = 0;
  private nextEventIndex = 0;
  private isRunning = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Playback speed multiplier. 1 = real-time, 2 = 2× speed, etc. */
  private speed: number;

  /** How frequently the clock ticks (ms). Lower = smoother. */
  private tickIntervalMs: number;

  /** Subscriber callbacks */
  private listeners: SimulationEventCallback[] = [];

  /** Fires every tick even when no event fires — for clock sync */
  private tickListeners: ((state: SimulationState) => void)[] = [];

  constructor(opts?: { speed?: number; tickIntervalMs?: number }) {
    this.speed = opts?.speed ?? 1;
    this.tickIntervalMs = opts?.tickIntervalMs ?? 250;
  }

  // ── Data Loading ────────────────────────────────────────────────

  /**
   * Load all simulation data. Call this once before `start()`.
   */
  load(
    meetingData: MeetingData,
    transcriptData: TranscriptLine[],
    participantData: Participant[],
    calendarData: CalendarData
  ) {
    // Store calendar
    this.calendar = calendarData;

    // Index participants by id
    this.participants = {};
    this.manualOverrides = {};
    for (const p of participantData) {
      this.participants[p.id] = { ...p };
    }

    // Build unified timeline
    const meetingEvents: TimelineEvent[] = meetingData.events.map((e) => ({
      time: e.time,
      type: e.type,
      participantId: e.participantId,
      data: e.data,
    }));

    const transcriptEvents: TimelineEvent[] = transcriptData.map((t) => ({
      time: t.time,
      type: "transcript" as const,
      participantId: t.speaker,
      data: { text: t.text },
    }));

    // Merge and sort by time, tie-break: meeting events first
    this.timeline = [...meetingEvents, ...transcriptEvents].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      // Meeting-level events should fire before transcript at the same second
      return a.type === "transcript" ? 1 : -1;
    });

    this.currentTime = 0;
    this.nextEventIndex = 0;
  }

  // ── Subscriptions ───────────────────────────────────────────────

  /** Subscribe to timeline events as they fire */
  onEvent(cb: SimulationEventCallback) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** Subscribe to every tick (for clock updates / progress bars) */
  onTick(cb: (state: SimulationState) => void) {
    this.tickListeners.push(cb);
    return () => {
      this.tickListeners = this.tickListeners.filter((l) => l !== cb);
    };
  }

  // ── Controls ────────────────────────────────────────────────────

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const secondsPerTick = (this.tickIntervalMs / 1000) * this.speed;

    this.intervalId = setInterval(() => {
      this.currentTime += secondsPerTick;

      // Fire all events whose time <= currentTime
      while (
        this.nextEventIndex < this.timeline.length &&
        this.timeline[this.nextEventIndex].time <= this.currentTime
      ) {
        const event = this.timeline[this.nextEventIndex];
        this.applyEvent(event);
        this.nextEventIndex++;

        // Notify event listeners
        const state = this.getState();
        for (const cb of this.listeners) {
          cb(event, state);
        }
      }

      // Notify tick listeners
      const state = this.getState();
      for (const cb of this.tickListeners) {
        cb(state);
      }

      // Auto-stop when we've played all events and gone past the last timestamp
      if (this.nextEventIndex >= this.timeline.length) {
        const lastTime = this.timeline[this.timeline.length - 1]?.time ?? 0;
        if (this.currentTime > lastTime + 2) {
          this.pause();
        }
      }
    }, this.tickIntervalMs);
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset() {
    this.pause();
    this.currentTime = 0;
    this.nextEventIndex = 0;
    this.manualOverrides = {};
    // Reset participants to initial state — reload from original data
    // (callers should call load() again for a full reset)
  }

  /**
   * Seek to a specific time. Resets and replays all events up to `targetTime`.
   * Fires event callbacks for each replayed event so the UI stays in sync.
   */
  seekTo(targetTime: number) {
    const wasRunning = this.isRunning;
    this.pause();

    // Reset to the start
    this.currentTime = 0;
    this.nextEventIndex = 0;

    // We need to re-apply participant state from scratch.
    // Reset all participants to their initial join-time state.
    for (const p of Object.values(this.participants)) {
      p.webcamOn = false;
      p.screenShare = false;
      // displayName will be set by join events
    }

    // Fast-forward: apply all events up to targetTime
    while (
      this.nextEventIndex < this.timeline.length &&
      this.timeline[this.nextEventIndex].time <= targetTime
    ) {
      const event = this.timeline[this.nextEventIndex];
      this.applyEvent(event);
      this.nextEventIndex++;

      // Fire listeners so UI updates
      const state = this.getState();
      for (const cb of this.listeners) {
        cb(event, state);
      }
    }

    this.currentTime = targetTime;

    // Notify tick listeners
    const state = this.getState();
    for (const cb of this.tickListeners) {
      cb(state);
    }

    if (wasRunning) this.start();
  }

  setSpeed(speed: number) {
    const wasRunning = this.isRunning;
    if (wasRunning) this.pause();
    this.speed = speed;
    if (wasRunning) this.start();
  }

  // ── State ───────────────────────────────────────────────────────

  getState(): SimulationState {
    return {
      currentTime: Math.round(this.currentTime * 10) / 10,
      isRunning: this.isRunning,
      firedEvents: this.timeline.slice(0, this.nextEventIndex),
      participants: { ...this.participants },
      calendar: this.calendar,
      timeline: this.timeline,
      totalDuration: this.timeline.length
        ? this.timeline[this.timeline.length - 1].time
        : 0,
    };
  }

  getTimeline(): TimelineEvent[] {
    return this.timeline;
  }

  getParticipants(): Record<string, Participant> {
    return { ...this.participants };
  }

  // ── Internal / Manual Overrides ─────────────────────────────────

  /**
   * Manually update a participant's state (e.g. from UI inputs to test signals live).
   */
  updateParticipant(id: string, updates: Partial<Participant>) {
    if (!this.manualOverrides[id]) this.manualOverrides[id] = {};
    Object.assign(this.manualOverrides[id], updates);

    if (this.participants[id]) {
      Object.assign(this.participants[id], updates);
      
      // Notify tick listeners so UI updates immediately
      const state = this.getState();
      for (const cb of this.tickListeners) {
        cb(state);
      }
    }
  }

  /**
   * Mutate participant state in response to an event.
   * This keeps the `participants` map always up-to-date.
   */
  private applyEvent(event: TimelineEvent) {
    const p = this.participants[event.participantId];
    if (!p) return;

    switch (event.type) {
      case "join":
        p.joinTime = event.time;
        if (event.data.displayName) {
          p.displayName = this.manualOverrides[p.id]?.displayName ?? event.data.displayName;
        }
        break;

      case "leave":
        p.leaveTime = event.time;
        break;

      case "webcam_on":
        p.webcamOn = true;
        break;

      case "webcam_off":
        p.webcamOn = false;
        break;

      case "name_change":
        if (event.data.newName) {
          p.displayName = this.manualOverrides[p.id]?.displayName ?? event.data.newName;
        }
        break;

      case "screen_share":
        p.screenShare = event.data.active ?? false;
        break;

      // "speaking" and "transcript" don't mutate participant state directly
      case "speaking":
      case "transcript":
        break;
    }
  }
}
