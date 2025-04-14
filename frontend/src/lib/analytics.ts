import { datadogRum } from "@datadog/browser-rum"
import { sendGAEvent } from "@next/third-parties/google"

import { GA_ID } from "./environment"

// Type definition for Google Analytics gtag function
declare global {
  interface Window {
    gtag: (
      command: "event" | "config" | "set",
      targetId: string,
      params: {
        user_id?: string
        event_category?: string
        event_label?: string
        value?: number
        [key: string]: unknown
      },
    ) => void
  }
}

type AnalyticsEvent = {
  action: string
  category?: string
  label?: string
  value?: number
  // Additional properties for custom dimensions/metrics
  [key: string]: unknown
}

interface TrackEventOptions {
  /** Use beacon transport for events that occur before navigation */
  sendBeforeNavigation?: boolean
}

/**
 * Track an event in both Google Analytics and Datadog RUM
 */
export function trackEvent(event: AnalyticsEvent, options: TrackEventOptions = {}): void {
  // Track in Google Analytics if enabled
  if (GA_ID) {
    try {
      sendGAEvent("event", event.action, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        transport_type: options.sendBeforeNavigation ? "beacon" : undefined,
        ...event,
      })
    } catch (error) {
      console.error("Failed to send GA event", error)
    }
  }

  // Track in Datadog RUM if enabled
  try {
    datadogRum.addAction(event.action, event)
  } catch (error) {
    console.error("Failed to track DD event", error)
  }
}

/**
 * Set analytics user data in both GA and Datadog
 */
export function setAnalyticsUser(user: {
  id: string | number
  name?: string
  email?: string
}): void {
  if (GA_ID && typeof window !== "undefined" && "gtag" in window) {
    try {
      window.gtag("config", GA_ID, {
        user_id: user.id.toString(),
      })
    } catch (error) {
      console.error("Failed to set GA user", error)
    }
  }

  try {
    datadogRum.setUser({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
    })
  } catch (error) {
    console.error("Failed to set DD user", error)
  }
}

// Common analytics events
export const AnalyticsEvents = {
  INSTALL_APP: "install_app",
  LOGIN: "login",
  PLAN_PURCHASED: "plan_purchased",
  PLAN_SELECTED: "plan_selected",
  PROJECT_CREATED: "project_created",
} as const
