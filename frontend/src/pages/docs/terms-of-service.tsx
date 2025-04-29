import { Container, Box } from "@mui/material"
import Head from "next/head"
import React, { type JSX } from "react"
import ReactMarkdown from "react-markdown"

import { MarketingLayout } from "@/components/NavBody"

const markdown = `
Vizdiff Terms of Service
========================

Last updated: January 01, 2024

This Terms of Service Agreement ("Agreement") is between MVI LLC ("Vizdiff," "We," "Us," "Our") located at 65 Nez Perce Dr, Inchelium, WA 99138, and the user of Vizdiff services ("Customer," "You," or "Your"). By accessing or using Vizdiff's services ("Services"), You agree to be bound by these Terms.

1. **Definitions**

- **Service(s)**: Vizdiff's screenshot testing platform accessible at [https://vizdiff.io](https://vizdiff.io), including any related tools and support.
- **Customer Data**: Data uploaded by You including screenshots, visual diffs, build metadata, and related information.
- **Subscription Plan**: The subscription plan You select, including monthly or annual billing, base fee, and metered usage fees.

2. **Provision of Services**

- Vizdiff provides screenshot testing services integrated with GitHub.
- Services include a 14-day free trial without requiring payment information. After this period, continued use requires selecting a Subscription Plan.
- We explicitly disclaim guarantees of uptime or availability.

3. **Billing, Payments, and Fees**

- Payments are processed via Stripe. You agree to monthly or annual billing cycles based on Your Subscription Plan.
- Subscription Plans include a base fee and additional metered billing for usage exceeding plan limits.
- Payment is due immediately upon billing. Vizdiff reserves the right to suspend or terminate Services for overdue payments.
- Vizdiff does not offer refunds beyond the initial 14-day trial, except in extraordinary circumstances at our sole discretion.

4. **Customer Data & Intellectual Property**

- You retain ownership of all Customer Data including screenshots, visual diffs, and associated metadata.
- You grant Vizdiff a limited, non-exclusive license to use Customer Data solely to deliver the Services.
- Vizdiff retains all rights, title, and interest in our proprietary technology and intellectual property.

5. **Support**

- Vizdiff provides email support during normal business hours.
- Future enhancements may include in-app chat support, subject to availability and our discretion.

6. **Usage Restrictions**

You agree not to:
- Use the Service for illegal or unlawful activities.
- Engage in activities that harm or disrupt Vizdiff's infrastructure or other users.
- Transmit malicious code, malware, viruses, or engage in other harmful practices.

7. **Removal of Customer Data & Account Suspension**

- Vizdiff may remove Customer Data or suspend accounts if:
  - Vizdiff receives a valid DMCA takedown notice.
  - Customer engages in activities violating applicable law.

8. **Confidentiality**

- Both parties agree to protect confidential information received from the other party with reasonable care.
- Confidential information does not include information that is publicly known, independently developed, or lawfully received from third parties.

9. **Indemnification**

- You agree to indemnify Vizdiff against any claims arising from Your misuse of the Service, violation of these Terms, or infringement of third-party rights by Your Data.

10. **Limitation of Liability**

- Vizdiff will not be liable for indirect, incidental, special, consequential, or punitive damages arising from Your use of the Service.
- Our total liability under this Agreement shall not exceed amounts paid by You to Vizdiff in the twelve (12) months preceding the claim.

11. **Termination**

- You may terminate Your account at any time by discontinuing use of the Service.
- Vizdiff may terminate or suspend Services immediately if You breach this Agreement or fail to pay fees.
- Upon termination, Your data will be deleted according to our Privacy Policy.

12. **General Provisions**

- This Agreement is governed by the laws of Washington State.
- All disputes arising from this Agreement will be resolved exclusively in the state or federal courts located in Washington.
- You may not assign this Agreement without prior written consent from Vizdiff.
- Vizdiff will not use Your name or logo publicly without explicit permission.
- This Agreement constitutes the entire agreement and supersedes prior understandings.
- Vizdiff reserves the right to modify these terms with notice to You via email or prominently displayed on the Service.

**Contact Information:**

If you have questions regarding these Terms, please contact MVI LLC at:

- Mail: 65 Nez Perce Dr, Inchelium, WA 99138
- Email: contact@vizdiff.io
`

export default function TermsOfService(): JSX.Element {
  return (
    <>
      <Head>
        <title>Terms of Service - vizdiff.io</title>
        <meta name="description" content="Terms of Service for vizdiff.io" />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 3 } }}>
          <Box
            sx={{
              textAlign: "left",
              maxWidth: "1200px",
            }}
          >
            <Box
              className="terms-of-service"
              sx={{
                "& p": { marginBottom: "1em" },
                "& ul": { marginBottom: "1em" },
                "& h1": { marginBottom: "0.5em" },
                "& h2": { marginBottom: "0.5em" },
                "& h3": { marginBottom: "0.5em" },
                "& h4": { marginBottom: "0.25em" },
              }}
            >
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </Box>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
