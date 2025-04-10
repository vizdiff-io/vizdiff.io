import { Container } from "@mui/material"
import Head from "next/head"

import { MarketingLayout } from "@/components/NavBody"

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
    highPrice: "499.00",
    lowPrice: "49.00",
    offerCount: "3",
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
          price: "149",
          priceCurrency: "USD",
          name: "vizdiff Standard monthly subscription",
          url: "https://vizdiff.io/signup?interval=monthly&plan=standard",
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
    ],
  },
}

export default function Pricing(): JSX.Element {
  return (
    <>
      <Head>
        <title>vizdiff.io - Pricing</title>
        <meta name="description" content="Screenshot testing made easy." />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg"></Container>
      </MarketingLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
