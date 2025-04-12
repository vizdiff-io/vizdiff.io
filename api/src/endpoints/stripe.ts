import { Stripe } from "stripe"

import { APP_URL, STRIPE_SECRET_KEY } from "../environment"
import { log } from "../log"
import { PRICE_IDS } from "../pricing"
import type { RequestHandler } from "../types"

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
