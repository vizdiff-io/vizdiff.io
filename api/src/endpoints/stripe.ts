import { User } from "shared"
import { Stripe } from "stripe"

import { Database } from "../database"
import { APP_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "../environment"
import { log } from "../log"
import { PRICE_IDS } from "../pricing"
import type { RequestWithRawBody, RequestHandler, DefaultResponse } from "../types"

type StripeLineItem = Stripe.Checkout.SessionCreateParams.LineItem

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

  const { user } = res.locals
  const stripe = new Stripe(STRIPE_SECRET_KEY)

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

function getPriceIds(plan: string, interval: string): StripeLineItem[] {
  const priceIds: StripeLineItem[] = []
  if (interval === "monthly") {
    if (plan === "starter") {
      priceIds.push({ price: PRICE_IDS.plan_starter_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_starter_monthly })
    } else if (plan === "team") {
      priceIds.push({ price: PRICE_IDS.plan_team_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_team_monthly })
    } else if (plan === "pro") {
      priceIds.push({ price: PRICE_IDS.plan_pro_monthly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_pro_monthly })
    } else {
      throw new Error("Invalid plan")
    }
  } else if (interval === "yearly") {
    if (plan === "starter") {
      priceIds.push({ price: PRICE_IDS.plan_starter_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_starter_monthly })
    } else if (plan === "team") {
      priceIds.push({ price: PRICE_IDS.plan_team_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_team_monthly })
    } else if (plan === "pro") {
      priceIds.push({ price: PRICE_IDS.plan_pro_yearly, quantity: 1 })
      priceIds.push({ price: PRICE_IDS.usage_screenshots_pro_monthly })
    } else {
      throw new Error("Invalid plan")
    }
  } else {
    throw new Error("Invalid interval")
  }
  return priceIds
}

// Function to extract plan and interval from Stripe price ID
function getPlanInfoFromPriceId(priceId: string): { plan: string; interval: string } | null {
  // Match price ID to the corresponding plan and interval
  for (const [key, value] of Object.entries(PRICE_IDS)) {
    if (value === priceId) {
      // Parse the key to extract plan and interval
      // Format is expected to be: plan_[planName]_[intervalName]
      const parts = key.split("_")
      if (parts.length >= 3 && parts[0] === "plan") {
        return { plan: parts[1]!, interval: parts[2]! }
      }
    }
  }
  return null
}

export async function stripeWebhook(req: RequestWithRawBody, res: DefaultResponse): Promise<void> {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe environment variables not set")
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
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
