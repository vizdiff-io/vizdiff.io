import { Analytics as CustomerIoAnalytics } from "@customerio/cdp-analytics-node"
import type { User } from "shared"

import { Database } from "./database"
import { APP_URL, CUSTOMER_IO_API_KEY } from "./environment"
import { log } from "./log"
import { getAccessibleProjectIds } from "./projectAccess"
import type { GithubUser } from "./schemas/GithubUser"
import type { DefaultRequest } from "./types"

let gCustomerIo: CustomerIoAnalytics | undefined

// Lazily initialize the Customer.io client
function getCustomerIo(): CustomerIoAnalytics | undefined {
  if (!CUSTOMER_IO_API_KEY) {
    return undefined
  }

  if (!gCustomerIo) {
    gCustomerIo = new CustomerIoAnalytics({ writeKey: CUSTOMER_IO_API_KEY })
  }
  return gCustomerIo
}

/**
 * Identify a user with Customer.io. Fire-and-forget method that will run asynchronously.
 * @param user The user to identify
 * @param req The request object
 */
export function identifyUser(user: User, req: DefaultRequest): void {
  const customerIo = getCustomerIo()
  if (!customerIo) {
    log.info("CUSTOMER_IO_API_KEY is not set, skipping user identification")
    return
  }

  // Fire off the async work without awaiting it
  void (async () => {
    const ghUser = user.githubProfile as Partial<GithubUser>
    let accessibleProjects: number | undefined

    // Try to get the count of accessible projects for this user
    try {
      const db = await Database()
      const ids = await getAccessibleProjectIds(db, user.id)
      accessibleProjects = ids.length
    } catch (error) {
      log.error(error, `Failed to get accessible project IDs for user ${user.id}`)
    }

    try {
      customerIo.identify(
        {
          userId: user.id.toString(),
          traits: {
            // BaseUserTraits
            id: user.id.toString(),
            name: ghUser.name,
            username: ghUser.login,
            website: ghUser.blog ?? ghUser.html_url,
            avatar: ghUser.avatar_url,
            company: ghUser.company ? { name: ghUser.company } : undefined,
            plan: user.subscriptionPlan,
            createdAt: user.createdAt,
            description: ghUser.bio,
            email: user.email,

            // Custom traits
            planInterval: user.subscriptionInterval,
            accessibleProjects,
            twitter: ghUser.twitter_username,
            ghPublicRepos: ghUser.public_repos,
            ghPublicGists: ghUser.public_gists,
            ghPrivateGists: ghUser.private_gists,
            ghPrivateTotalRepos: ghUser.total_private_repos,
            ghPrivateOwnedRepos: ghUser.owned_private_repos,
            ghFollowers: ghUser.followers,
            ghFollowing: ghUser.following,
            ghLocation: ghUser.location,
            ghPlan: ghUser.plan?.name,
          },
          context: {
            ip: req.realIp,
            userAgent: req.headers["user-agent"],
          },
        },
        (err) => {
          if (err) {
            log.error({ err, user }, `Failed to identify user ${user.id} with Customer.io`)
          }
        },
      )
    } catch (err) {
      log.error({ err, user }, `Failed to identify user ${user.id} with Customer.io`)
    }
  })()
}

/**
 * Track an event with Customer.io
 * @param userId The user ID to track the event for
 * @param req (optional) request object, if the event is triggered by a web request from the user
 *   (not a webhook or background job)
 * @param event The event name to track
 * @param properties Additional custom properties to track with the event
 */
export function trackEvent(
  userId: number,
  req: DefaultRequest | undefined,
  event: string,
  properties: Record<string, unknown>,
): void {
  const customerIo = getCustomerIo()
  if (!customerIo) {
    log.info("CUSTOMER_IO_API_KEY is not set, skipping event tracking")
    return
  }

  try {
    customerIo.track(
      {
        userId: userId.toString(),
        event,
        properties,
        context: {
          ip: req?.realIp,
          userAgent: req?.headers["user-agent"],
        },
      },
      (err) => {
        if (err) {
          log.error(
            { err, userId },
            `Failed to track event ${event} for user ${userId} with Customer.io`,
          )
        }
      },
    )
  } catch (err) {
    log.error({ err, userId }, `Failed to track event ${event} for user ${userId} with Customer.io`)
  }
}

/**
 * Track a page view with Customer.io
 * @param userId The user ID to track the page view for
 * @param req The request object for extracting IP and user agent
 * @param pageName The name of the page to track
 * @param properties Additional custom properties to track with the page view
 */
export function trackPageView(
  userId: number,
  req: DefaultRequest,
  pageName: string,
  properties?: Record<string, unknown>,
): void {
  const customerIo = getCustomerIo()
  if (!customerIo) {
    log.info("CUSTOMER_IO_API_KEY is not set, skipping page view tracking")
    return
  }

  // Customer.io typically uses window.location.href for `name`, so build a full URL
  const url = new URL(pageName, APP_URL)

  try {
    customerIo.page({
      userId: userId.toString(),
      name: url.toString(),
      properties,
      context: {
        ip: req.realIp,
        userAgent: req.headers["user-agent"],
      },
    })
  } catch (err) {
    log.error({ err, userId }, `Failed to track page view for user ${userId} with Customer.io`)
  }
}
