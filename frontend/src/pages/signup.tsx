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
} from "@mui/material"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"

import { AppLayout } from "@/components/AppLayout"
import LeftSidebar from "@/components/LeftSidebar"
import useAuth from "@/hooks/useAuth"
import { apiPost } from "@/lib/apiMethods"
import { PRICING_PLANS } from "@/lib/pricing"

interface StripeCheckoutResponse {
  url: string
}

export default function Signup(): JSX.Element {
  const router = useRouter()
  const { user } = useAuth()
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectToCheckout = useCallback(
    async (plan: string, interval: string) => {
      if (!user) {
        setError("User is not logged in.")
        return
      }
      if (isCheckoutLoading) {
        return // Prevent double clicks
      }

      setIsCheckoutLoading(true)
      setError(null)

      try {
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
        setError(err instanceof Error ? err.message : "An unknown error occurred during checkout.")
        setIsCheckoutLoading(false)
      }
    },
    // Don't depend on `isCheckoutLoading` to avoid an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  )

  // Handle redirect based on URL parameters
  useEffect(() => {
    const { plan: planName, interval, checkout } = router.query

    // Handle checkout status returns
    if (checkout === "success") {
      // Could show success message or redirect
    } else if (checkout === "cancel") {
      setError("Checkout was cancelled.")
    }

    // Handle direct checkout from URL params
    if (planName && interval && typeof planName === "string" && typeof interval === "string") {
      const plan = PRICING_PLANS.find((p) => p.name.toLowerCase() === planName.toLowerCase())

      if (plan) {
        const intervalValue = interval === "yearly" || interval === "annual" ? "yearly" : "monthly"
        // Redirect to checkout via our server endpoint
        void redirectToCheckout(planName.toLowerCase(), intervalValue)
      } else {
        setError(`Unknown plan name: ${planName}`)
      }
    }
  }, [router.query, redirectToCheckout])

  return (
    <>
      <Head>
        <title>Signup - vizdiff.io</title>
        <meta name="description" content="Project listing" />
      </Head>
      <AppLayout>
        <Box sx={{ display: "flex", gap: 3, px: 3, py: 4, minHeight: "calc(100vh - 64px)" }}>
          <LeftSidebar />

          {/* Main Content */}
          <Box sx={{ flex: 1 }}>
            <Container maxWidth="lg" sx={{ py: 8 }}>
              <Typography
                variant="h2"
                component="h1"
                align="center"
                gutterBottom
                sx={{ fontWeight: "bold", mb: 6 }}
              >
                Plans that scale with your screenshot testing needs
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 4 }}>
                  {error}
                </Alert>
              )}
              {isCheckoutLoading && !error && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ ml: 2 }}>Redirecting to checkout...</Typography>
                </Box>
              )}
              <Grid container spacing={4} justifyContent="center">
                {PRICING_PLANS.map((plan) => (
                  <Grid item key={plan.name} xs={12} sm={6} md={4}>
                    <Card
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        border: "1px solid",
                        borderColor: "var(--five-percent-opacity)",
                        borderRadius: 2,
                      }}
                    >
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
                            ${plan.monthlyPrice}
                          </Typography>
                          <Typography variant="subtitle1" component="span" sx={{ ml: 1 }}>
                            /month
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="var(--text-secondary)">
                          or{" "}
                          <Link href={plan.annualUrl} passHref legacyBehavior>
                            <a style={{ fontWeight: "bold", textDecoration: "underline" }}>
                              ${plan.annualMonthlyPrice}/month billed annually
                            </a>
                          </Link>
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
                            void redirectToCheckout(plan.name.toLowerCase(), "monthly")
                          }
                          disabled={isCheckoutLoading}
                        >
                          {plan.ctaText}
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
                ))}
              </Grid>
            </Container>
          </Box>
        </Box>
      </AppLayout>
    </>
  )
}
