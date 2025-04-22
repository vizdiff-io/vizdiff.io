import { User } from "shared"
import { Stripe } from "stripe"

import type { BillingPeriodUsageResponse } from "../apiTypes"
import { Database } from "../database"
import {
  APP_URL,
  STRIPE_API_VERSION,
  STRIPE_SECRET_KEY,
  STRIPE_SCREENSHOT_METER_ID,
  STRIPE_WEBHOOK_SECRET,
  MAX_TRIAL_SCREENSHOTS,
} from "../environment"
import { log } from "../log"
import { getSubscriptionIncludedUsage } from "../pricing"
import { getPriceIds, getPlanInfoFromPriceId } from "../stripe"
import type { RequestWithRawBody, RequestHandler, DefaultResponse } from "../types"

interface CheckoutBody {
  plan: string
  interval: string
  key: string
}

export const createCheckoutSession: RequestHandler = async (req, res) => {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }

  // Get required params from request body
  const { plan, interval, key } = req.body as Partial<CheckoutBody>
  if (!plan || !interval || !key) {
    res.status(400).json({ error: "Missing required parameters: plan, interval, key" })
    return
  }

  // Validate plan and interval
  if (plan !== "starter" && plan !== "team" && plan !== "pro") {
    res.status(400).json({ error: "Invalid plan" })
    return
  }
  if (interval !== "monthly" && interval !== "yearly") {
    res.status(400).json({ error: "Invalid interval" })
    return
  }

  const { user } = res.locals
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })

  // Create a Stripe checkout session
  log.info(
    { user, plan, interval, key },
    `Creating ${interval} ${plan} Stripe checkout session for ${user.id} (${user.email})`,
  )
  const session = await stripe.checkout.sessions.create(
    {
      cancel_url: `${APP_URL}/signup?checkout=cancel`,
      success_url: `${APP_URL}/signup?checkout=success`,
      client_reference_id: user.id.toString(),
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.email ?? undefined,
      subscription_data: {
        description: `vizdiff.io ${interval} ${plan} plan`,
      },
      line_items: getPriceIds(plan, interval),
      mode: "subscription",
    },
    { idempotencyKey: key },
  )
  log.info(
    { user, plan, interval, key, session },
    `Stripe checkout session created for ${user.id} (${user.email})`,
  )

  // Return the checkout session URL for the client to redirect to
  res.json({ url: session.url })
}

export const getBillingPeriodUsage: RequestHandler = async (_req, res) => {
  const { user } = res.locals

  // Basic configuration checks
  if (!STRIPE_SECRET_KEY) {
    log.error("STRIPE_SECRET_KEY is not set")
    res.status(500).json({ error: "Server configuration error" })
    return
  }
  if (!STRIPE_SCREENSHOT_METER_ID) {
    throw new Error("STRIPE_SCREENSHOT_METER_ID is not set")
  }

  // Stripe customer ID should have been created at signup or last login
  if (!user.stripeCustomerId) {
    log.error({ user }, `User ${user.id} has no Stripe customer ID, cannot fetch usage`)
    res.status(500).json({ error: "Missing billing information" })
    return
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })

  if (!user.stripeSubscriptionId) {
    // User is in a trial, fetch usage from signup to trial end or now, whichever is later
    const periodStartSec = Math.floor(user.createdAt.getTime() / 1000)
    const trialEndSec = Math.floor((user.trialEndsAt ?? new Date()).getTime() / 1000)
    const periodEndSec = Math.max(Math.floor(new Date().getTime() / 1000), trialEndSec)
    const usageSummaries = await stripe.billing.meters.listEventSummaries(
      STRIPE_SCREENSHOT_METER_ID,
      {
        customer: user.stripeCustomerId,
        start_time: periodStartSec,
        end_time: periodEndSec,
        limit: 100,
      },
    )
    let totalUsage = 0
    for (const summary of usageSummaries.data) {
      totalUsage += isNaN(summary.aggregated_value) ? 0 : summary.aggregated_value
    }

    const json: BillingPeriodUsageResponse = {
      totalUsage,
      subscriptionIncludedUsage: MAX_TRIAL_SCREENSHOTS,
      periodStartSec,
      periodEndSec,
      status: "trial",
    }
    res.json(json)
    return
  }

  try {
    // 1. Get the upcoming invoice preview to determine the current billing period dates
    let invoicePreview: Stripe.Invoice | null = null
    try {
      // Use createPreview as per the user's type definitions
      invoicePreview = await stripe.invoices.createPreview({
        customer: user.stripeCustomerId,
        subscription: user.stripeSubscriptionId,
      })
    } catch (error) {
      log.error(
        error,
        `Could not create invoice preview for subscription ${user.stripeSubscriptionId} (user ${user.id}).`,
      )
      res.status(500).json({ error: "Failed to retrieve upcoming invoice data." })
      return
    }

    // 2. Extract period dates from the invoice preview
    const currentPeriodStartSec = invoicePreview.period_start
    const currentPeriodEndSec = invoicePreview.period_end

    // 3. Fetch the actual usage summaries for this determined period
    const usageSummaries = await stripe.billing.meters.listEventSummaries(
      STRIPE_SCREENSHOT_METER_ID,
      {
        customer: user.stripeCustomerId,
        start_time: currentPeriodStartSec,
        end_time: currentPeriodEndSec,
        limit: 100,
      },
    )

    // 4. Sum the aggregated values
    let totalUsage = 0
    for (const summary of usageSummaries.data) {
      totalUsage += isNaN(summary.aggregated_value) ? 0 : summary.aggregated_value
    }

    // 5. Return the usage and the billing period dates derived from the preview
    const json: BillingPeriodUsageResponse = {
      totalUsage,
      subscriptionIncludedUsage: getSubscriptionIncludedUsage(user.subscriptionPlan),
      periodStartSec: currentPeriodStartSec,
      periodEndSec: currentPeriodEndSec,
      status: invoicePreview.status ?? "draft",
    }
    res.json(json)
  } catch (error) {
    // Catch errors not handled by the specific preview try/catch
    log.error(error, `Generic error fetching billing period usage for user ${user.id}`)
    if (error instanceof Stripe.errors.StripeError) {
      res.status(500).json({ error: `Stripe API error: ${error.message}` })
    } else {
      res.status(500).json({ error: "Failed to retrieve billing usage data." })
    }
  }
}

export async function stripeWebhook(req: RequestWithRawBody, res: DefaultResponse): Promise<void> {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe environment variables not set")
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
  const signature = req.headers["stripe-signature"]

  if (!req.rawBody || !signature) {
    res.status(400).json({ error: "Missing signature or request body" })
    return
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature.toString(), STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const error = err as Error
    log.error(error, "Stripe webhook signature verification failed")
    res.status(400).json({ error: "Webhook signature verification failed" })
    return
  }

  const db = await Database()

  try {
    // Handle specific event types we care about
    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      if (!session.client_reference_id) {
        log.error({ event }, "Missing client_reference_id in checkout session")
      } else if (session.customer && session.subscription) {
        const userId = parseInt(session.client_reference_id, 10)
        if (isNaN(userId)) {
          log.error({ event }, "Invalid user ID in client_reference_id")
        } else {
          // Update user with new customer and subscription IDs
          await db.manager.update(
            User,
            { id: userId },
            {
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : session.customer.id,
              stripeSubscriptionId:
                typeof session.subscription === "string"
                  ? session.subscription
                  : session.subscription.id,
            },
          )

          log.info(
            { userId, customerId: session.customer, subscriptionId: session.subscription },
            "Updated user with Stripe customer and subscription IDs",
          )
        }
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object

      // Get the plan price ID from the subscription line items
      if (!subscription.items.data.length) {
        log.error({ event }, "No line items in subscription")
      } else {
        // We're interested in the plan price, not the usage price
        const planLineItem = subscription.items.data.find((item) => item.price.id.includes("plan_"))

        if (!planLineItem) {
          log.error({ event }, "Could not find plan line item in subscription")
        } else {
          // Extract plan and interval from price ID
          const planInfo = getPlanInfoFromPriceId(planLineItem.price.id)
          if (!planInfo) {
            log.error(
              { event, priceId: planLineItem.price.id },
              "Could not extract plan info from price ID",
            )
          } else {
            // Find user by Stripe customer ID
            const customerId =
              typeof subscription.customer === "string"
                ? subscription.customer
                : subscription.customer.id

            const user = await db.manager.findOneBy(User, { stripeCustomerId: customerId })

            if (!user) {
              log.error({ event, customerId }, "User not found for Stripe customer")
            } else {
              // Update user's subscription info
              await db.manager.update(
                User,
                { id: user.id },
                {
                  stripeSubscriptionId: subscription.id,
                  subscriptionPlan: planInfo.plan,
                  subscriptionInterval: planInfo.interval,
                },
              )

              log.info(
                { userId: user.id, planInfo, subscriptionId: subscription.id },
                `Updated user subscription to ${planInfo.interval} ${planInfo.plan} plan`,
              )
            }
          }
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object

      // Find user by subscription ID
      const user = await db.manager.findOneBy(User, { stripeSubscriptionId: subscription.id })

      if (user) {
        // Clear subscription data from user
        await db.manager.update(
          User,
          { id: user.id },
          {
            stripeSubscriptionId: null,
            subscriptionPlan: null,
            subscriptionInterval: null,
          },
        )

        log.info(
          { userId: user.id, subscriptionId: subscription.id },
          "Cleared user subscription data after subscription deleted",
        )
      } else {
        log.warn({ subscriptionId: subscription.id }, "User not found for deleted subscription")
      }
    } else {
      // For other event types, just log and acknowledge
      log.info({ eventType: event.type }, "Received Stripe webhook event")
    }

    // Return a 200 success response
    res.json({ received: true })
  } catch (err) {
    const error = err as Error
    log.error(error, "Error processing Stripe webhook")
    res.status(500).json({ error: "Error processing webhook" })
  }
}
