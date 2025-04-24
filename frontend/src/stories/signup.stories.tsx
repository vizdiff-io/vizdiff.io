import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { within, userEvent } from "@storybook/testing-library"
import { http, HttpResponse } from "msw"
import { type ComponentType, useEffect } from "react"

import type { UserResponse, BillingPeriodUsageResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
import { catchAllHandler } from "./mocks"
import SignupComponent from "../pages/signup"

type StoryArgs = {
  mode?: "light" | "dark"
  billingInterval?: "monthly" | "yearly"
  subscription?: {
    plan: string
    interval: string
  } | null
  isCheckoutLoading?: boolean
  checkoutError?: string | null
}

const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60
const fixedDate = new Date("2025-04-01T08:00:00Z")
const trialEndDate = new Date("2025-04-15T08:00:00Z") // Example trial end
const periodStartDate = new Date("2025-04-01T00:00:00Z") // Example period start
const periodEndDate = new Date("2025-05-01T00:00:00Z") // Example period end

// Create base mock user
const createMockUser = (subscription: StoryArgs["subscription"]): UserResponse => ({
  id: 123,
  githubId: "user123",
  email: "user@example.com",
  githubUsername: "user123",
  githubProfile: {
    login: "user123",
    name: "User 123",
    id: 123,
    node_id: "node123",
    avatar_url: "https://github.com/avatar.png",
    email: "user@example.com",
  },
  ownedProjectCount: 1,
  trialEndStampSec: oneMinuteAgo,
  createdStampSec: fixedDate.getTime() / 1000,
  updatedStampSec: oneMinuteAgo,
  githubInstallations: [],
  subscription: subscription ?? null,
})

// Create base mock usage response
const createMockUsageResponse = (
  subscription: StoryArgs["subscription"],
): BillingPeriodUsageResponse => {
  let totalUsage = 0
  let subscriptionIncludedUsage = 5000 // Default trial limit
  let status: BillingPeriodUsageResponse["status"] = "trial"
  let periodStartSec = fixedDate.getTime() / 1000
  let periodEndSec = trialEndDate.getTime() / 1000

  if (subscription) {
    status = "open" // Assume active paid subscription
    periodStartSec = periodStartDate.getTime() / 1000
    periodEndSec = periodEndDate.getTime() / 1000

    switch (subscription.plan) {
      case "starter":
        totalUsage = 15000
        subscriptionIncludedUsage = 15000
        break
      case "team":
        totalUsage = 60001
        subscriptionIncludedUsage = 60000
        break
      case "pro":
        totalUsage = 1372802
        subscriptionIncludedUsage = 250000
        break
      default:
        // Keep trial limit if plan unknown
        totalUsage = 3719
        subscriptionIncludedUsage = 5000
        status = "trial"
        periodStartSec = fixedDate.getTime() / 1000
        periodEndSec = trialEndDate.getTime() / 1000
        break
    }
  }

  return {
    totalUsage,
    subscriptionIncludedUsage,
    periodStartSec,
    periodEndSec,
    status,
  }
}

// Default user with no subscription
const defaultUser = createMockUser(null)

// Helper component to force the billing interval toggle
const BillingIntervalSetter = ({
  billingInterval,
  children,
}: {
  billingInterval: "monthly" | "yearly"
  children: React.ReactNode
}) => {
  useEffect(() => {
    // Force billingInterval by simulating a button click on the correct toggle
    if (billingInterval === "yearly") {
      setTimeout(() => {
        const yearlyButton = document.querySelector('[aria-label="yearly billing"]')
        if (yearlyButton && yearlyButton instanceof HTMLElement) {
          yearlyButton.click()
        }
      }, 100)
    }
  }, [billingInterval])

  return <>{children}</>
}

const meta: Meta<typeof SignupComponent> = {
  title: "stories/pages/Signup",
  component: SignupComponent,
  argTypes: {
    mode: {
      control: "radio",
      options: ["light", "dark"],
      defaultValue: "light",
    },
    billingInterval: {
      control: "radio",
      options: ["monthly", "yearly"],
      defaultValue: "monthly",
    },
    subscription: {
      control: "object",
    },
    isCheckoutLoading: {
      control: "boolean",
      defaultValue: false,
    },
    checkoutError: {
      control: "text",
    },
  },
  decorators: [
    (Story: ComponentType, context: StoryContext<StoryArgs>): JSX.Element => {
      // Set authentication cookie for Storybook
      document.cookie = "authenticated=true; path=/"

      return (
        <ThemeWrapper mode={context.args.mode ?? "light"}>
          <BillingIntervalSetter billingInterval={context.args.billingInterval ?? "monthly"}>
            <Story />
          </BillingIntervalSetter>
        </ThemeWrapper>
      )
    },
  ],
  parameters: {
    nextjs: {
      router: {
        query: (context: StoryContext<StoryArgs>) => {
          const { billingInterval, checkoutError } = context.args
          const query: Record<string, string> = {}

          if (billingInterval) {
            query.interval = billingInterval
          }

          if (checkoutError) {
            query.checkout = "cancel"
          }

          return query
        },
      },
    },
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(defaultUser)
        }),
        http.post("/api/stripe/checkout", () => {
          return HttpResponse.json({ url: "https://example.com/checkout" })
        }),
        http.get("/api/stripe/usage", () => {
          // Default mock usage response (trial user)
          const mockUsage = createMockUsageResponse(null)
          return HttpResponse.json(mockUsage)
        }),
        catchAllHandler,
      ],
    },
  },
}

export default meta
type Story = StoryObj<typeof SignupComponent>

// Basic variants by theme
export const Light: Story = { args: { mode: "light" } }

export const Dark: Story = { args: { mode: "dark" } }

// Billing interval variants
export const MonthlyBilling: Story = {
  args: {
    billingInterval: "monthly",
  },
}

export const YearlyBilling: Story = {
  args: {
    billingInterval: "yearly",
  },
}

// Subscription variants
export const WithStarterMonthlyPlan: Story = {
  args: {
    subscription: {
      plan: "starter",
      interval: "monthly",
    },
    billingInterval: "monthly",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(
            createMockUser({
              plan: "starter",
              interval: "monthly",
            }),
          )
        }),
        http.get("/api/stripe/usage", () => {
          const mockUsage = createMockUsageResponse({
            plan: "starter",
            interval: "monthly",
          })
          return HttpResponse.json(mockUsage)
        }),
        catchAllHandler,
      ],
    },
  },
  name: "User with Starter Monthly Plan",
}

export const WithTeamYearlyPlan: Story = {
  args: {
    subscription: {
      plan: "team",
      interval: "yearly",
    },
    billingInterval: "yearly",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(
            createMockUser({
              plan: "team",
              interval: "yearly",
            }),
          )
        }),
        http.get("/api/stripe/usage", () => {
          const mockUsage = createMockUsageResponse({
            plan: "team",
            interval: "yearly",
          })
          return HttpResponse.json(mockUsage)
        }),
        catchAllHandler,
      ],
    },
  },
  name: "User with Team Yearly Plan",
}

export const WithProMonthlyPlan: Story = {
  args: {
    subscription: {
      plan: "pro",
      interval: "monthly",
    },
    billingInterval: "monthly",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(
            createMockUser({
              plan: "pro",
              interval: "monthly",
            }),
          )
        }),
        http.get("/api/stripe/usage", () => {
          const mockUsage = createMockUsageResponse({
            plan: "pro",
            interval: "monthly",
          })
          return HttpResponse.json(mockUsage)
        }),
        catchAllHandler,
      ],
    },
  },
  name: "User with Pro Monthly Plan",
}

// UI states
export const CheckoutLoading: Story = {
  args: {
    isCheckoutLoading: true,
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(defaultUser)
        }),
        http.post("/api/stripe/checkout", async () => {
          // Simulate a delay for the loading state to appear
          await new Promise((resolve) => setTimeout(resolve, 10000))
          return HttpResponse.json({ url: "#" })
        }),
        catchAllHandler,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    // Wait for component to fully render
    await new Promise((resolve) => setTimeout(resolve, 500))

    const canvas = within(canvasElement)

    // Find the first plan's "Select plan" button (should be the Starter plan)
    const buttons = canvas.getAllByRole("button")
    const selectPlanButton = buttons.find(
      (btn) => !btn.hasAttribute("disabled") && btn.textContent?.includes("Select plan"),
    )

    if (selectPlanButton) {
      // Click the button to trigger checkout process
      await userEvent.click(selectPlanButton)
    }
  },
  name: "Checkout Loading State",
}

export const CheckoutError: Story = {
  args: {
    checkoutError: "An error occurred during checkout. Please try again.",
  },
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users/me", () => {
          return HttpResponse.json(defaultUser)
        }),
        http.post("/api/stripe/checkout", () => {
          return HttpResponse.json(
            { error: "An error occurred during checkout. Please try again." },
            { status: 400 },
          )
        }),
        catchAllHandler,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    // Wait for component to fully render
    await new Promise((resolve) => setTimeout(resolve, 500))

    const canvas = within(canvasElement)

    // Find the Team plan's "Select plan" button (middle plan)
    const buttons = canvas.getAllByRole("button")
    const selectPlanButton = buttons.find(
      (btn) => !btn.hasAttribute("disabled") && btn.textContent?.includes("Select plan"),
    )

    if (selectPlanButton) {
      // Click the button to trigger checkout process and show error
      await userEvent.click(selectPlanButton)
    }
  },
  name: "Checkout Error State",
}
