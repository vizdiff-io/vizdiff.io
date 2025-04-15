import { Stripe } from "stripe"

import { STRIPE_API_VERSION, STRIPE_SECRET_KEY } from "./environment"
import { log } from "./log"
import { PRICE_IDS } from "./pricing"

export type StripeLineItem = Stripe.Checkout.SessionCreateParams.LineItem
export type StripePlan = "starter" | "team" | "pro"
export type StripeInterval = "monthly" | "yearly"

/**
 * Permanently deletes a customer. It cannot be undone. Also immediately cancels any active
 * subscriptions on the customer.
 * @param customerId The Stripe customer ID to delete
 */
export async function deleteStripeCustomer(customerId: string): Promise<void> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })

  try {
    log.warn({ customerId }, `Deleting Stripe customer ${customerId}`)
    await stripe.customers.del(customerId)
    log.info({ customerId }, `Deleted Stripe customer ${customerId}`)
  } catch (error) {
    log.error({ customerId, error }, "Failed to delete Stripe customer")
    throw error
  }
}

/**
 * Returns the price IDs for a given plan and interval
 * @param plan The plan to get the price IDs for
 * @param interval The interval to get the price IDs for
 * @returns The price IDs for the given plan and interval
 */
export function getPriceIds(plan: StripePlan, interval: StripeInterval): StripeLineItem[] {
  const priceIds: StripeLineItem[] = []
  if (interval === "monthly") {
    if (plan === "starter") {
      priceIds.push({ price: PRICE_IDS.plan_starter_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_starter_monthly })
    } else if (plan === "team") {
      priceIds.push({ price: PRICE_IDS.plan_team_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_team_monthly })
    } else {
      // plan === "pro"
      priceIds.push({ price: PRICE_IDS.plan_pro_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_pro_monthly })
    }
  } else {
    // interval === "yearly"
    if (plan === "starter") {
      priceIds.push({ price: PRICE_IDS.plan_starter_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_starter_monthly })
    } else if (plan === "team") {
      priceIds.push({ price: PRICE_IDS.plan_team_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_team_monthly })
    } else {
      // plan === "pro"
      priceIds.push({ price: PRICE_IDS.plan_pro_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_pro_monthly })
    }
  }
  return priceIds
}

/**
 * Returns the plan and interval for a given price ID
 * @param priceId The Stripe price ID to parse the plan and interval from
 */
export function getPlanInfoFromPriceId(
  priceId: string,
): { plan: StripePlan; interval: StripeInterval } | null {
  // Match price ID to the corresponding plan and interval
  for (const [key, value] of Object.entries(PRICE_IDS)) {
    if (value === priceId) {
      // Parse the key to extract plan and interval
      // Format is expected to be: plan_[planName]_[intervalName]
      const parts = key.split("_")
      if (parts.length >= 3 && parts[0] === "plan") {
        const plan = parts[1]!
        const interval = parts[2]!
        if (plan === "starter" || plan === "team" || plan === "pro") {
          if (interval === "monthly" || interval === "yearly") {
            return { plan, interval }
          }
        }
        throw new Error(`Invalid stripe price key "${key}" for price ID "${priceId}"`)
      }
    }
  }
  return null
}
