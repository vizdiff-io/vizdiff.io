/**
 * Issue #125 — dependent task ordering.
 *
 * When two commits A (older, lower task-queue id) then B (newer, higher id) land
 * on the same branch and B's render task depends on A's baseline, the worker must
 * process A *before* B so that B sees a populated baseline instead of an empty
 * one.
 *
 * This suite drives the *real* `pollForNewTasks` loop (the sibling worker test
 * file stubs it out) against a simulated task queue and asserts the processing
 * order. It reproduces the exact regression called out in review: previously the
 * worker re-polled exactly when the deferral window expired, so the deferred
 * (newer, higher-id) task B was no longer excluded and descending-id selection
 * re-picked B instead of its dependency A. The fix re-polls strictly *before* the
 * exclusion window expires (DEFER_REPOLL_MS < DEFER_INTERVAL_MS), so A is the
 * only eligible candidate at the re-poll and runs first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import "reflect-metadata"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// --- Simulated task queue --------------------------------------------------

type QueuedTask = { task_type: string; screenshot_test_id: number; data: any }

const queue = new Map<number, QueuedTask>()
const processedOrder: number[] = []
const isBaselineBuildPending = vi.fn(async (_screenshotTestId: number) => false)
// Screenshot-test ids whose ingest should fail (to exercise the retry/backoff/give-up paths).
const failingTestIds = new Set<number>()

// Mock the queue *selection* layer (these helpers are imported by worker.ts from
// ./tasks). `latestTaskQueueId` returns the newest (highest id) task NOT in the
// caller's exclude set — mirroring production `ORDER BY id DESC` + `id NOT IN`.
vi.mock("./tasks", async (importOriginal) => {
  const actual: object = await importOriginal()
  return {
    ...actual,
    latestTaskQueueId: vi.fn(async (excludeIds: ReadonlySet<number> = new Set()) => {
      const ids = [...queue.keys()].filter((id) => !excludeIds.has(id)).sort((a, b) => b - a)
      return ids.length > 0 ? ids[0] : undefined
    }),
    fetchTask: vi.fn(async (id: number) => queue.get(id)),
  }
})

// Mock the ingest layer. `isBaselineBuildPending` reports whether a render task's
// baseline is still in flight; `ingestStorybook` records the processing order.
vi.mock("./ingest", () => ({
  isBaselineBuildPending: (id: number) => isBaselineBuildPending(id),
  ingestStorybook: vi.fn(async (_projectId: string, screenshotTestId: number) => {
    if (failingTestIds.has(screenshotTestId)) {
      throw new Error(`Simulated ingest failure for test ${screenshotTestId}`)
    }
    processedOrder.push(screenshotTestId)
  }),
}))

// worker.ts's `deleteTask`/`releaseLock` are *local* functions that run SQL via
// DatabasePool(). Model the queue at that layer so a successfully-processed task
// is actually removed from our simulated queue (DELETE) and `sweepStuckBuilds`'s
// no-task branch is harmless.
vi.mock("./database", () => ({
  Database: vi.fn(async () => ({
    getRepository: vi.fn(() => ({
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      })),
      save: vi.fn().mockResolvedValue({}),
      findOneBy: vi.fn().mockResolvedValue(null),
    })),
  })),
  DatabasePool: vi.fn(async () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("DELETE FROM task_queue")) {
        queue.delete(params[0] as number)
      }
      return { rows: [], rowCount: 0 }
    }),
    release: vi.fn(),
  })),
}))

vi.mock("./health", () => ({
  startHealthServer: vi.fn(),
  markTaskStarted: vi.fn(),
  markTaskFinished: vi.fn(),
}))

vi.mock("pg-listen", () => ({
  default: vi.fn().mockImplementation(() => ({
    notifications: { on: vi.fn() },
    events: { on: vi.fn() },
    connect: vi.fn(),
    listenTo: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Imported after the mocks above are registered. worker.ts does not start its
// background loop under test (NODE_ENV === "test"), so this just gives us the
// real `pollForNewTasks` with the dependencies above mocked.
// eslint-disable-next-line import/first -- must load after the vi.mock() calls above
import { pollForNewTasks } from "./worker"

// Task-queue ids: A is older (lower id), B is newer (higher id).
const TASK_A_ID = 100
const TASK_B_ID = 200
// Screenshot-test ids, used to identify which task ran via processedOrder.
const TEST_A_ID = 1000
const TEST_B_ID = 2000

// Flush pending promise microtasks AND process.nextTick callbacks (the worker
// chains its next poll after a success via process.nextTick) so the async poll
// body runs to completion. `await Promise.resolve()` alone does NOT drain
// nextTick in this environment, so we explicitly schedule a continuation behind
// the nextTick queue on each iteration.
async function flushMicrotasks(times = 30): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
    await new Promise<void>((resolve) => process.nextTick(resolve))
  }
}

// Drive the self-rescheduling poll loop deterministically. We use *synchronous*
// fake-timer advancement plus manual microtask flushing rather than the async
// timer helpers: under the default forks pool those helpers cannot fake
// process.nextTick (which the worker uses to chain polls after a success), and
// pumping real nextTick through them blows the heap.
async function pump(done: () => boolean, stepMs: number, maxSteps = 50): Promise<void> {
  await flushMicrotasks()
  for (let i = 0; i < maxSteps && !done(); i++) {
    vi.advanceTimersByTime(stepMs)
    await flushMicrotasks()
  }
}

describe("dependent task ordering — worker processes A before B (#125)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    queue.clear()
    processedOrder.length = 0
    failingTestIds.clear()
    isBaselineBuildPending.mockReset()
    isBaselineBuildPending.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("processes the older dependency A before the newer dependent B; B never runs against an empty baseline", async () => {
    // Both queued: A (older render of base_commit_sha, still pending) and B
    // (newer, depends on A). B is at a HIGHER id, so naive descending-id
    // selection would pick B first.
    queue.set(TASK_A_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: TEST_A_ID,
      data: { projectId: "p", uploadId: "upload-a" },
    })
    queue.set(TASK_B_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: TEST_B_ID,
      data: { projectId: "p", uploadId: "upload-b" },
    })

    // B's baseline (A) is in flight until A has been processed and removed from
    // the queue. A itself has no pending baseline.
    isBaselineBuildPending.mockImplementation(async (screenshotTestId: number) => {
      if (screenshotTestId === TEST_B_ID) {
        return queue.has(TASK_A_ID)
      }
      return false
    })

    pollForNewTasks()
    // Advance in 1s steps so we cross the deferral re-poll (2s) and the
    // exclusion-window expiry (5s) boundaries in order.
    await pump(() => processedOrder.includes(TEST_A_ID) && processedOrder.includes(TEST_B_ID), 1000)

    // A must be processed strictly before B...
    expect(processedOrder.indexOf(TEST_A_ID)).toBeGreaterThanOrEqual(0)
    expect(processedOrder.indexOf(TEST_B_ID)).toBeGreaterThanOrEqual(0)
    expect(processedOrder.indexOf(TEST_A_ID)).toBeLessThan(processedOrder.indexOf(TEST_B_ID))

    // ...and the very first task the worker actually ran is A, not B. This is the
    // crux of the regression: without the fix the worker re-selects B at the
    // re-poll and runs it first (against an empty baseline).
    expect(processedOrder[0]).toBe(TEST_A_ID)

    // By the time B ran, A had already been removed from the queue, so its
    // baseline was ready — B did not run against an empty baseline.
    expect(queue.has(TASK_A_ID)).toBe(false)
    expect(queue.has(TASK_B_ID)).toBe(false)
  })

  it("falls back to processing B after MAX_DEFER_COUNT if its baseline never finishes (livelock guard)", async () => {
    // Only B is queued and its baseline is reported pending forever. The worker
    // must still make forward progress and eventually process B.
    queue.set(TASK_B_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: TEST_B_ID,
      data: { projectId: "p", uploadId: "upload-b" },
    })
    isBaselineBuildPending.mockResolvedValue(true)

    pollForNewTasks()
    // MAX_DEFER_COUNT is 60. With B as the only task, each deferral cycle spans
    // the exclusion window (5s) plus the empty re-poll interval (10s), so advance
    // in 15s steps with a cap comfortably above 60 so the deferrals exhaust and
    // the fallback processes B.
    await pump(() => processedOrder.includes(TEST_B_ID), 15_000, 120)

    expect(processedOrder).toContain(TEST_B_ID)
    expect(queue.has(TASK_B_ID)).toBe(false)
  })
})

describe("failure backoff and give-up", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    queue.clear()
    processedOrder.length = 0
    failingTestIds.clear()
    isBaselineBuildPending.mockReset()
    isBaselineBuildPending.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("does not let a failing newest task starve older runnable tasks", async () => {
    // The newest task (higher id) always fails; the older task must still run
    // while the failing one sits in its backoff window. Before the fix,
    // latestTaskQueueId() only ever returned the newest id, so the poll just
    // slept and the older task was never considered.
    const OLD_TASK_ID = 300
    const OLD_TEST_ID = 3000
    const FAILING_TASK_ID = 400
    const FAILING_TEST_ID = 4000

    queue.set(OLD_TASK_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: OLD_TEST_ID,
      data: { projectId: "p", uploadId: "upload-old" },
    })
    queue.set(FAILING_TASK_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: FAILING_TEST_ID,
      data: { projectId: "p", uploadId: "upload-failing" },
    })
    failingTestIds.add(FAILING_TEST_ID)

    pollForNewTasks()
    // First poll picks the failing (newest) task; the next poll (10s later) must
    // exclude it (its first backoff window is 30s) and pick the older task.
    await pump(() => processedOrder.includes(OLD_TEST_ID), 10_000)

    expect(processedOrder).toContain(OLD_TEST_ID)
    expect(queue.has(OLD_TASK_ID)).toBe(false)
    // The failing task is still queued (it is in backoff, not given up yet).
    expect(queue.has(FAILING_TASK_ID)).toBe(true)
  })

  it("deletes a task from the queue after exhausting its retry budget", async () => {
    // A task that fails MAX_RETRY_COUNT+1 times must be removed from the queue,
    // not left in place to restart the retry cycle forever.
    const DOOMED_TASK_ID = 500
    const DOOMED_TEST_ID = 5000

    queue.set(DOOMED_TASK_ID, {
      task_type: "ingest_storybook",
      screenshot_test_id: DOOMED_TEST_ID,
      data: { projectId: "p", uploadId: "upload-doomed" },
    })
    failingTestIds.add(DOOMED_TEST_ID)

    pollForNewTasks()
    // Exponential backoff between attempts sums to ~15.5 minutes before the
    // sixth failure exhausts the budget (MAX_RETRY_COUNT = 5); advance in poll
    // interval (10s) steps with a cap comfortably above that.
    await pump(() => !queue.has(DOOMED_TASK_ID), 10_000, 150)

    expect(queue.has(DOOMED_TASK_ID)).toBe(false)
    expect(processedOrder).not.toContain(DOOMED_TEST_ID)
  })
})
