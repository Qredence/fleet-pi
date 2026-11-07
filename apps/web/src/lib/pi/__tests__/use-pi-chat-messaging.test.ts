// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { usePiChatMessaging } from "../use-pi-chat-messaging"

import type { ChatClient } from "../chat-client"
import type { QueueState } from "../chat-fetch"
import type { ChatSessionMetadata } from "@workspace/pi-protocol/chat-protocol"
import type { ChatMessage } from "@workspace/pi-protocol/chat-types"
import type { MutableRefObject } from "react"

function deferredSignal() {
  let rejectSignal: ((error: Error) => void) | undefined
  const promise = new Promise<void>((_resolve, reject) => {
    rejectSignal = reject
  })
  return {
    promise,
    rejectSignal(error: Error) {
      rejectSignal?.(error)
    },
  }
}

function renderMessaging(streamMessage: ChatClient["streamMessage"]) {
  const abortRef: MutableRefObject<AbortController | null> = { current: null }
  const followUpAbortRef: MutableRefObject<AbortController | null> = {
    current: null,
  }
  const messagesRef: MutableRefObject<Array<ChatMessage>> = { current: [] }
  const sessionMetadataRef: MutableRefObject<ChatSessionMetadata> = {
    current: { sessionId: "session-1" },
  }
  const queueRef: MutableRefObject<QueueState> = {
    current: { followUp: [], steering: [] },
  }
  const client = { streamMessage } as ChatClient

  const hook = renderHook(() =>
    usePiChatMessaging({
      abortRef,
      activityLabelRef: { current: undefined },
      client,
      followUpAbortRef,
      messagesRef,
      mode: "agent",
      model: { id: "model", provider: "google" },
      planLabelRef: { current: undefined },
      queueRef,
      recoverFromForbiddenSession: () => Promise.resolve(),
      refreshSessions: () => Promise.resolve(),
      sessionMetadataRef,
      setActivityLabelSynced: vi.fn(),
      setError: vi.fn(),
      setMessagesSynced: vi.fn(),
      setPlanLabelSynced: vi.fn(),
      setQueueSynced: vi.fn(),
      setSessionMetadataSynced: vi.fn(),
      setStatus: vi.fn(),
      status: "streaming",
    })
  )

  return { ...hook, abortRef, followUpAbortRef }
}

describe("queueFollowUp", () => {
  it("passes an abort signal and stays quiet when that signal aborts", async () => {
    let signal: AbortSignal | undefined
    const { promise, rejectSignal } = deferredSignal()
    const { result, followUpAbortRef, abortRef } = renderMessaging(
      (_request, _onEvent, nextSignal) => {
        signal = nextSignal
        nextSignal?.addEventListener("abort", () => {
          rejectSignal(
            new DOMException("The operation was aborted.", "AbortError")
          )
        })
        return promise
      }
    )

    let pending!: Promise<void>
    act(() => {
      pending = result.current.queueFollowUp("next step", "agent", "followUp")
    })

    expect(signal?.aborted).toBe(false)
    expect(abortRef.current).toBeNull()

    act(() => {
      followUpAbortRef.current?.abort()
    })

    await act(async () => {
      await pending
    })
    expect(signal?.aborted).toBe(true)
  })

  it("aborts the previous follow-up when another one starts", () => {
    const signals: Array<AbortSignal> = []
    const { result, abortRef, followUpAbortRef } = renderMessaging(
      (_request, _onEvent, nextSignal) => {
        if (!nextSignal) throw new Error("missing signal")
        signals.push(nextSignal)
        return new Promise<void>((_resolve, reject) => {
          nextSignal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        })
      }
    )

    act(() => {
      void result.current.queueFollowUp("first", "agent", "followUp")
    })
    act(() => {
      void result.current.queueFollowUp("second", "agent", "steer")
    })

    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
    expect(abortRef.current).toBeNull()

    act(() => {
      followUpAbortRef.current?.abort()
    })
  })

  it("rejects when the follow-up request fails", async () => {
    const { result } = renderMessaging(() =>
      Promise.reject(new Error("queue failed"))
    )

    await expect(
      result.current.queueFollowUp("next step", "agent", "followUp")
    ).rejects.toThrow("queue failed")
  })
})
