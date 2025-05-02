import { User } from "shared"
import { Stripe } from "stripe"

import type { BillingPeriodUsageResponse } from "../apiTypes"
import { trackEvent } from "../customerio"
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
  const body = req.body as Partial<CheckoutBody> | undefined
  const { plan, interval, key } = body ?? {}
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
      customer_email: user.stripeCustomerId ? undefined : (user.email ?? undefined),
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

  // Track the checkout session creation event with Customer.io
  trackEvent(user.id, req, "checkout_session_created", { plan, interval })

  // Return the checkout session URL for the client to redirect to
  res.json({ url: session.url })
}

export const getBillingPeriodUsage: RequestHandler = async (_req, res) => {
  let { user } = res.locals

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
  const db = await Database()

  // Sync with Stripe before proceeding
  try {
    res.locals.user = await syncStripeSubscription(user, stripe, db)
    user = res.locals.user
  } catch (error) {
    // Log the sync error but proceed, using potentially stale data
    log.error(
      error,
      `Failed to sync Stripe subscription for user ${user.id}. Proceeding with potentially stale data.`,
    )
  }

  // The `syncStripeSubscription()` call should never clear the customer ID, but we check here
  // for type safety
  if (!user.stripeCustomerId) {
    log.error({ user }, `User ${user.id} has no Stripe customer ID after sync, cannot fetch usage`)
    res.status(500).json({ error: "Missing billing information" })
    return
  }

  if (!user.stripeSubscriptionId) {
    // User is in a trial (or potentially subscription lapsed/sync failed)
    // Fetch usage based on trial dates or creation date
    const periodStartSec = Math.floor(user.createdAt.getTime() / 1000)
    const trialEndSec = Math.floor((user.trialEndsAt ?? new Date()).getTime() / 1000)
    const periodEndSec = Math.max(Math.floor(new Date().getTime() / 1000), trialEndSec)

    try {
      log.debug({ userId: user.id, periodStartSec, periodEndSec }, "Fetching trial usage")
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
    } catch (error) {
      log.error(error, `Error fetching trial usage summaries for user ${user.id}`)
      res.status(500).json({ error: "Failed to retrieve trial usage data." })
    }
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

  log.info({ event }, `Received Stripe webhook event ${event.type}`)

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

          // Track the checkout session completion event with Customer.io
          trackEvent(userId, undefined, "checkout_session_completed", {
            amount: session.amount_total,
            currency: session.currency,
            locale: session.locale,
          })
        }
      } else {
        log.error({ event }, "Missing customer or subscription in checkout session")
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
        const planLineItem = subscription.items.data.find(
          (item) => item.price.nickname?.includes("plan_") ?? false,
        )

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

              // Track the subscription update event with Customer.io
              trackEvent(user.id, undefined, "subscription_updated", {
                plan: planInfo.plan,
                interval: planInfo.interval,
              })

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
        const { subscriptionPlan, subscriptionInterval } = user

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

        // Track the subscription deletion event with Customer.io
        trackEvent(user.id, undefined, "subscription_deleted", {
          plan: subscriptionPlan,
          interval: subscriptionInterval,
        })

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

// Helper function to sync user's subscription state with Stripe
async function syncStripeSubscription(
  user: User,
  stripe: Stripe,
  db: Awaited<ReturnType<typeof Database>>,
): Promise<User> {
  if (!user.stripeCustomerId) {
    // Cannot sync without a customer ID
    return user
  }

  let subscription: Stripe.Subscription | undefined

  if (user.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)

      if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
        // If retrieve succeeded but status is canceled/expired, or retrieve failed (throws),
        // clear local subscription info if it wasn't already cleared by webhook.
        if (user.stripeSubscriptionId || user.subscriptionPlan || user.subscriptionInterval) {
          log.warn(
            { userId: user.id, subscriptionId: user.stripeSubscriptionId, subscription },
            "Subscription ID found in DB but subscription is missing or canceled in Stripe. Clearing local state.",
          )
          await db.manager.update(
            User,
            { id: user.id },
            {
              stripeSubscriptionId: null,
              subscriptionPlan: null,
              subscriptionInterval: null,
            },
          )
          user.stripeSubscriptionId = null
          user.subscriptionPlan = null
          user.subscriptionInterval = null
        }
        subscription = undefined // Ensure we don't proceed with a canceled/deleted sub
      }
    } catch (error) {
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.code === "resource_missing"
      ) {
        // Subscription ID exists in DB but not in Stripe (deleted). Clear local state.
        if (user.stripeSubscriptionId || user.subscriptionPlan || user.subscriptionInterval) {
          log.warn(
            { userId: user.id, subscriptionId: user.stripeSubscriptionId, subscription },
            "Subscription ID found in DB but not found in Stripe (likely deleted). Clearing local state.",
          )
          await db.manager.update(
            User,
            { id: user.id },
            {
              stripeSubscriptionId: null,
              subscriptionPlan: null,
              subscriptionInterval: null,
            },
          )
          user.stripeSubscriptionId = null
          user.subscriptionPlan = null
          user.subscriptionInterval = null
        }
      } else {
        // Log other errors but don't necessarily block the request
        log.error(error, `Error retrieving subscription ${user.stripeSubscriptionId} during sync`)
      }
      subscription = undefined // Ensure we don't proceed if there was an error
    }
  }

  // If no subscription ID was present, or the existing one was invalid/deleted,
  // check if an active one exists for the customer.
  if (!subscription && user.stripeCustomerId) {
    try {
      const customerSubscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      })
      if (customerSubscriptions.data.length > 0) {
        subscription = customerSubscriptions.data[0]!
        log.info(
          { userId: user.id, newSubscriptionId: subscription.id, subscription },
          "Found active subscription in Stripe not previously recorded in DB.",
        )
      }
    } catch (error) {
      log.error(
        error,
        `Error listing subscriptions for customer ${user.stripeCustomerId} during sync`,
      )
    }
  }

  // Now, if we have an active subscription object, compare and update DB
  if (subscription && subscription.status === "active") {
    const planLineItem = subscription.items.data.find(
      (item) => item.price.nickname?.includes("plan_") ?? false,
    )
    const planInfo = planLineItem ? getPlanInfoFromPriceId(planLineItem.price.id) : null

    if (
      subscription.id !== user.stripeSubscriptionId ||
      planInfo?.plan !== user.subscriptionPlan ||
      planInfo.interval !== user.subscriptionInterval
    ) {
      if (planInfo) {
        log.info(
          { userId: user.id, subscriptionId: subscription.id, subscription, planInfo },
          "Stripe subscription state differs from DB. Updating user record.",
        )
        await db.manager.update(
          User,
          { id: user.id },
          {
            stripeSubscriptionId: subscription.id,
            subscriptionPlan: planInfo.plan,
            subscriptionInterval: planInfo.interval,
          },
        )
        // Update the user object in memory as well
        user.stripeSubscriptionId = subscription.id
        user.subscriptionPlan = planInfo.plan
        user.subscriptionInterval = planInfo.interval
      } else {
        log.error(
          { userId: user.id, subscriptionId: subscription.id, subscription },
          "Active subscription found but could not determine plan info from price ID.",
        )
      }
    }
  } else if (!subscription && user.stripeSubscriptionId) {
    // This case is handled above by clearing the subscription details if retrieve fails or status is canceled.
    // If we reach here and !subscription, it means either no sub exists or it's not active/trialing.
    // We ensure the DB reflects this lack of an active subscription.
    if (user.subscriptionPlan || user.subscriptionInterval) {
      log.warn(
        { userId: user.id, subscriptionId: user.stripeSubscriptionId, subscription },
        "User has subscription ID in DB, but no active subscription found in Stripe. Clearing plan details.",
      )
      await db.manager.update(
        User,
        { id: user.id },
        {
          // Keep stripeSubscriptionId for potential reactivation/history,
          // but clear plan details to reflect non-active state.
          subscriptionPlan: null,
          subscriptionInterval: null,
        },
      )
      user.subscriptionPlan = null
      user.subscriptionInterval = null
    }
  }

  return user
}
