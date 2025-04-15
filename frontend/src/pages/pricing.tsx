import CheckIcon from "@mui/icons-material/Check"
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material"
import Head from "next/head"
import Link from "next/link"

import { MarketingLayout } from "@/components/NavBody"
import { PRICING_PLANS } from "@/lib/pricing"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "vizdiff",
  url: "https://vizdiff.io",
  "@id": "https://vizdiff.io/#webapplication",
  browserRequirements: ["requires HTML5 support", "requires JavaScript"],
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  targetPlatform: "Web",
  featureList: [
    "Storybook screenshot testing",
    "Visual regression testing",
    "GitHub Actions integration",
  ],
  copyrightHolder: {
    "@type": "corporation",
    name: "MVI",
    legalName: "MVI LLC",
    "@id": "https://mvi.llc#organization",
    sameAs: ["https://mvi.llc", "https://www.linkedin.com/company/mvi-dot-llc"],
  },
  creator: { "@id": "https://mvi.llc#organization" },
  publisher: { "@id": "https://mvi.llc#organization" },
  offers: {
    "@type": "AggregateOffer",
    highPrice: "4790.00",
    lowPrice: "49.00",
    offerCount: "6",
    priceCurrency: "USD",
    offers: [
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "49",
          priceCurrency: "USD",
          name: "vizdiff Starter monthly subscription",
          url: "https://vizdiff.io/signup?interval=monthly&plan=starter",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "MON",
          },
        },
      },
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "470",
          priceCurrency: "USD",
          name: "vizdiff Starter annual subscription",
          url: "https://vizdiff.io/signup?interval=yearly&plan=starter",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "ANN",
          },
        },
      },
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "149",
          priceCurrency: "USD",
          name: "vizdiff Team monthly subscription",
          url: "https://vizdiff.io/signup?interval=monthly&plan=team",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "MON",
          },
        },
      },
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "1430",
          priceCurrency: "USD",
          name: "vizdiff Team annual subscription",
          url: "https://vizdiff.io/signup?interval=yearly&plan=team",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "ANN",
          },
        },
      },
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "499",
          priceCurrency: "USD",
          name: "vizdiff Pro monthly subscription",
          url: "https://vizdiff.io/signup?interval=monthly&plan=pro",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "MON",
          },
        },
      },
      {
        "@type": "Offer",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "4790",
          priceCurrency: "USD",
          name: "vizdiff Pro annual subscription",
          url: "https://vizdiff.io/signup?interval=yearly&plan=pro",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: "1",
            unitCode: "ANN",
          },
        },
      },
    ],
  },
}

export default function Pricing(): JSX.Element {
  return (
    <>
      <Head>
        <title>Pricing - vizdiff.io</title>
        <meta name="description" content="Screenshot testing made easy." />
      </Head>
      <MarketingLayout>
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
                      or <strong>${plan.annualMonthlyPrice}</strong>/month billed annually
                    </Typography>
                    <Button
                      variant="contained"
                      component={Link}
                      href={plan.monthlyUrl}
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
      </MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
