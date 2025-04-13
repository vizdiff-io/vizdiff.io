import type { Meta, StoryObj, StoryContext } from "@storybook/react"
import { within, userEvent } from "@storybook/testing-library"
import { http, HttpResponse } from "msw"
import { type ComponentType, useEffect } from "react"

import type { UserResponse } from "@/lib/apiTypes"

import ThemeWrapper from "./ThemeWrapper"
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

// Create base mock user
const createMockUser = (subscription: StoryArgs["subscription"]): UserResponse => ({
  id: 123,
  githubId: "user123",
  email: "user@example.com",
  githubUsername: "user123",
  githubProfile: {
    login: "user123",
    id: 123,
    node_id: "node123",
    avatar_url: "https://github.com/avatar.png",
    email: "user@example.com",
  },
  createdStampSec: Date.now() / 1000,
  updatedStampSec: Date.now() / 1000,
  githubInstallations: [],
  subscription: subscription ?? null,
})

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
