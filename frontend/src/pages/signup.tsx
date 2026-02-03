import CheckIcon from "@mui/icons-material/Check"
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  Container,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
} from "@mui/material"
import Link from "next/link"
import { useRouter } from "next/router"
import { type JSX, useEffect, useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"

import { AppLayout } from "@/components/AppLayout"
import LeftSidebar from "@/components/LeftSidebar"
import { Seo } from "@/components/Seo"
import useAuth from "@/hooks/useAuth"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { apiPost, apiGet } from "@/lib/apiMethods"
import type { BillingPeriodUsageResponse } from "@/lib/apiTypes"
import { PRICING_PLANS } from "@/lib/pricing"

interface StripeCheckoutResponse {
  url: string
}

// Hook to fetch billing usage
function useBillingUsage(): [BillingPeriodUsageResponse | null, boolean, Error | null, boolean] {
  const [usageData, setUsageData] = useState<BillingPeriodUsageResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [stripeDisabled, setStripeDisabled] = useState(false)

  useEffect(() => {
    const fetchUsage = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [data, apiError] = await apiGet<BillingPeriodUsageResponse>("/api/stripe/usage")
        if (apiError) {
          if (apiError.response?.status === 404) {
            setStripeDisabled(true)
            setUsageData(null)
            return
          }
          throw new Error(apiError.message || "Failed to fetch billing usage")
        }
        setUsageData(data)
      } catch (err) {
        console.error("Failed to fetch billing usage:", err)
        setError(err instanceof Error ? err : new Error("An unknown error occurred"))
      } finally {
        setIsLoading(false)
      }
    }

    void fetchUsage()
  }, [])

  return [usageData, isLoading, error, stripeDisabled]
}

export default function Signup(): JSX.Element {
  const router = useRouter()
  const { user } = useAuth()
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly")
  const [usageData, isUsageLoading, usageError, stripeDisabled] = useBillingUsage()

  const redirectToCheckout = useCallback(
    async (plan: string, interval: string) => {
      if (!user) {
        setCheckoutError("User is not logged in.")
        return
      }
      if (stripeDisabled) {
        setCheckoutError("Billing is disabled for this installation.")
        return
      }
      if (isCheckoutLoading) {
        return // Prevent double clicks
      }

      setIsCheckoutLoading(true)
      setCheckoutError(null)

      try {
        // Track plan selection
        trackEvent({
          action: AnalyticsEvents.PLAN_SELECTED,
          category: "Pricing",
          label: `${plan}_${interval}`,
          plan,
          interval,
          userId: user.id,
        })

        const [response, apiError] = await apiPost<StripeCheckoutResponse>("/api/stripe/checkout", {
          plan,
          interval,
          key: uuidv4(),
        })

        if (apiError || !response) {
          throw new Error(apiError?.message ?? "Failed to create checkout session")
        }

        // Redirect to Stripe Checkout
        window.location.href = response.url
      } catch (err) {
        console.error("Checkout error:", err)
        setCheckoutError(
          err instanceof Error ? err.message : "An unknown error occurred during checkout.",
        )
        setIsCheckoutLoading(false)
      }
    },
    // Don't depend on `isCheckoutLoading` to avoid an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  )

  // Handle redirect based on URL parameters
  useEffect(() => {
    if (!router.isReady) {
      return
    }
    const { checkout } = router.query

    // Handle checkout status returns
    if (checkout === "success" && user) {
      // Extract details from query params
      const successPlan = router.query.plan as string | undefined
      const successInterval = router.query.interval as string | undefined
      const valueString = router.query.value as string | undefined
      const currency = router.query.currency as string | undefined
      const value = valueString ? parseFloat(valueString) : undefined
      console.log(
        `Checkout Success: Plan=${successPlan}, Interval=${successInterval}, Value=${value}, Currency=${currency}`,
      )

      // Track successful checkout return with purchase details
      trackEvent({
        action: AnalyticsEvents.PURCHASE,
        category: "Subscription",
        label: `checkout_success_${successPlan}_${successInterval}`,
        userId: user.id,
        plan: successPlan,
        interval: successInterval,
        value,
        currency,
      })

      // Clean the URL by removing checkout-related query parameters
      const {
        checkout: _c,
        interval: _i,
        plan: _p,
        value: _v,
        currency: _cur,
        ...restQuery
      } = router.query
      void router.replace(
        {
          pathname: router.pathname,
          query: restQuery,
        },
        undefined,
        { shallow: true },
      )
    } else if (checkout === "cancel" && user) {
      setCheckoutError("Checkout was cancelled.")
    }

    // Set the initial billing interval from URL if provided (outside the checkout success block)
    // Use original 'interval' variable from outer scope here
    const initialInterval = router.query.interval as string | undefined
    if (initialInterval && typeof initialInterval === "string" && !router.query.checkout) {
      setBillingInterval(
        initialInterval === "yearly" || initialInterval === "annual" ? "yearly" : "monthly",
      )
    }
    // We only want this to run when router is ready and not on every router.query change
    // to prevent multiple analytics events from firing during the same page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, user]) // Keep dependencies minimal

  // Check if the user has the current plan
  const isCurrentPlan = useCallback(
    (planName: string) => {
      if (!user?.subscription) {
        return false
      }
      return (
        user.subscription.plan.toLowerCase() === planName.toLowerCase() &&
        user.subscription.interval === billingInterval
      )
    },
    [user, billingInterval],
  )

  const handleIntervalChange = (
    _event: React.MouseEvent<HTMLElement>,
    newInterval: "monthly" | "yearly" | null,
  ) => {
    if (newInterval != null) {
      setBillingInterval(newInterval)
    }
  }

  return (
    <>
      <Seo title="VizDiff: Signup" canonical="https://vizdiff.io/signup"></Seo>
      <AppLayout>
        <Box
          sx={{
            display: "flex",
            gap: 3,
            px: { xs: 0, sm: 3 },
            py: { xs: 0, md: 4 },
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <LeftSidebar selectedItem="billing" />

          {/* Main Content */}
          <Box sx={{ flex: 1 }}>
            <Container maxWidth="lg" sx={{ px: 0, py: { xs: 0, sm: 2 } }}>
              <Typography
                variant="h2"
                component="h1"
                align="center"
                gutterBottom
                sx={{
                  fontWeight: { xs: 600, sm: "bold" },
                  lineHeight: { xs: 1.1, sm: 1.2 },
                  mb: 3,
                }}
              >
                Plans that scale with your testing needs
              </Typography>

              {user?.subscription && (
                <Alert severity="info" sx={{ mb: 4 }}>
                  You currently have an active {user.subscription.interval} {user.subscription.plan}{" "}
                  plan.
                </Alert>
              )}

              {stripeDisabled && (
                <Alert severity="info" sx={{ mb: 4 }}>
                  Billing is disabled for this installation. Subscription changes are not
                  available.
                </Alert>
              )}

              {checkoutError && (
                <Alert severity="error" sx={{ mb: 4 }}>
                  {checkoutError}
                </Alert>
              )}

              {isCheckoutLoading && !checkoutError && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ ml: 2 }}>Redirecting to checkout...</Typography>
                </Box>
              )}

              {/* Billing interval toggle */}
              <Box sx={{ display: "flex", justifyContent: "center", mb: 5, mt: 2 }}>
                <ToggleButtonGroup
                  value={billingInterval}
                  exclusive
                  onChange={handleIntervalChange}
                  aria-label="billing interval"
                  color="primary"
                >
                  <ToggleButton value="monthly" aria-label="monthly billing">
                    Monthly
                  </ToggleButton>
                  <ToggleButton value="yearly" aria-label="yearly billing">
                    Yearly
                    <Chip
                      label="Save 20%"
                      size="small"
                      color="success"
                      sx={{ ml: 1, height: 20 }}
                    />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Pricing plans */}
              <Grid container spacing={3} justifyContent="center">
                {PRICING_PLANS.map((plan) => {
                  const isPlanActive = isCurrentPlan(plan.name)

                  return (
                    <Grid key={plan.name} size={{ xs: 12, sm: 6, lg: 4 }}>
                      <Card
                        sx={{
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          border: "1px solid",
                          borderColor: isPlanActive
                            ? "primary.main"
                            : "var(--five-percent-opacity)",
                          borderRadius: 2,
                          position: "relative",
                        }}
                      >
                        {isPlanActive && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: 0,
                              right: 0,
                              backgroundColor: "primary.main",
                              color: "var(--text-on-primary)",
                              py: 0.5,
                              px: 1.5,
                              borderBottomLeftRadius: 8,
                            }}
                          >
                            <Typography variant="caption" fontWeight="bold">
                              CURRENT PLAN
                            </Typography>
                          </Box>
                        )}

                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography
                            variant="h5"
                            component="h2"
                            gutterBottom
                            sx={{ fontWeight: "bold" }}
                          >
                            {plan.name}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "baseline", my: 2 }}>
                            <Typography variant="h3" component="span">
                              $
                              {billingInterval === "monthly"
                                ? plan.monthlyPrice
                                : plan.annualMonthlyPrice}
                            </Typography>
                            <Typography variant="subtitle1" component="span" sx={{ ml: 1 }}>
                              /month
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="var(--text-secondary)">
                            {billingInterval === "monthly" ? (
                              <>
                                or save 20% with{" "}
                                <Link
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    setBillingInterval("yearly")
                                  }}
                                >
                                  <Typography
                                    component="span"
                                    fontWeight="bold"
                                    sx={{
                                      textDecoration: "underline",
                                      cursor: "pointer",
                                    }}
                                  >
                                    yearly billing
                                  </Typography>
                                </Link>
                              </>
                            ) : (
                              <>billed annually (${plan.annualPrice})</>
                            )}
                          </Typography>
                          <Button
                            variant="contained"
                            fullWidth
                            sx={{
                              my: 3,
                              py: 1.5,
                              bgcolor: "primary.main",
                              color: "var(--text-on-primary)",
                              "&:hover": {
                                bgcolor: "primary.dark",
                              },
                            }}
                            onClick={() =>
                              void redirectToCheckout(plan.name.toLowerCase(), billingInterval)
                            }
                            disabled={isCheckoutLoading || isPlanActive || stripeDisabled}
                          >
                            {isPlanActive ? "Current Plan" : plan.ctaText}
                          </Button>
                          <List dense>
                            {plan.features.map((feature) => (
                              <ListItem key={feature} disableGutters>
                                <ListItemIcon sx={{ minWidth: "auto", mr: 1 }}>
                                  <CheckIcon fontSize="small" color="success" />
                                </ListItemIcon>
                                <ListItemText primary={feature} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>
                      </Card>
                    </Grid>
                  )
                })}
              </Grid>

              <Box sx={{ my: 5 }} />

              {/* Display Billing Usage */}
              {isUsageLoading && !stripeDisabled && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
                  <CircularProgress size={24} />
                  <Typography sx={{ ml: 2 }}>Loading usage data...</Typography>
                </Box>
              )}
              {usageError && !isUsageLoading && !stripeDisabled && (
                <Alert severity="warning" sx={{ mb: 4 }}>
                  Could not load current usage data: {usageError.message}
                </Alert>
              )}
              {usageData && !isUsageLoading && !usageError && !stripeDisabled && (
                <Card sx={{ mb: 4, p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Current {usageData.status === "trial" ? "Trial" : "Billing"} Period Usage
                  </Typography>
                  <Typography variant="body2" color="var(--text-secondary)" sx={{ mb: 1 }}>
                    {new Date(usageData.periodStartSec * 1000).toLocaleDateString()} -{" "}
                    {new Date(usageData.periodEndSec * 1000).toLocaleDateString()}
                  </Typography>
                  <List dense>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Included screenshots:"
                        secondary={`${Math.min(usageData.totalUsage, usageData.subscriptionIncludedUsage).toLocaleString()} / ${usageData.subscriptionIncludedUsage.toLocaleString()}`}
                        slotProps={{
                          primary: { color: "var(--text-primary)" },
                        }}
                      />
                    </ListItem>
                    {usageData.totalUsage > usageData.subscriptionIncludedUsage && (
                      <ListItem disableGutters>
                        <ListItemText
                          primary="Overage:"
                          secondary={`${(usageData.totalUsage - usageData.subscriptionIncludedUsage).toLocaleString()} screenshot${usageData.totalUsage - usageData.subscriptionIncludedUsage > 1 ? "s" : ""}`}
                          slotProps={{
                            primary: { color: "var(--text-primary)" },
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Card>
              )}
            </Container>
          </Box>
        </Box>
      </AppLayout>
    </>
  )
}
