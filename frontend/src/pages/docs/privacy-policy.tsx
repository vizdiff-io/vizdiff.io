import { Container, Box } from "@mui/material"
import Head from "next/head"
import React from "react"
import ReactMarkdown from "react-markdown"

import { MarketingLayout } from "@/components/NavBody"

const markdown = `
Privacy Policy
==============

Last updated: January 01, 2024

This Privacy Policy describes Our policies and procedures on the collection, use, and disclosure of Your information when You use the Service and informs You about Your privacy rights and how the law protects You.

We use Your Personal Data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.

Interpretation and Definitions
------------------------------

### Interpretation
The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or plural.

### Definitions
For the purposes of this Privacy Policy:

* **Account** means a unique account created for You to access our Service.
* **Company** ("the Company", "We", "Us", or "Our") refers to MVI LLC, 65 Nez Perce Dr, Inchelium, WA 99138.
* **Cookies** are small files placed on Your device by a website, containing details of Your browsing history.
* **Country** refers to: Washington, United States.
* **Device** means any device that can access the Service.
* **Personal Data** means any information relating to an identified or identifiable individual.
* **Service** refers to Vizdiff, accessible from [https://vizdiff.io](https://vizdiff.io/).
* **Service Provider** means any entity processing data on behalf of the Company.
* **Third-party Social Media Service** refers to any website or social network website through which a User can log in or create an account.
* **Usage Data** refers to data collected automatically from Service usage.
* **Website** refers to Vizdiff, accessible from [https://vizdiff.io](https://vizdiff.io/).
* **You** refers to the individual or legal entity accessing or using the Service.

Collecting and Using Your Personal Data
---------------------------------------

### Types of Data Collected

#### Personal Data
While using Our Service, We may collect:
* Email address
* First and last name
* Usage Data

#### Usage Data
Collected automatically, may include IP address, browser type, pages visited, visit date/time, unique device identifiers, and diagnostic data.

#### Information from Third-Party Services
We use GitHub integration for account creation and authentication. We may collect your GitHub account information including your name, email, repository metadata, commit hashes, and PR metadata necessary to provide the Service.

#### Tracking Technologies and Cookies
We use Session and Persistent Cookies to provide essential functionality and improve user experience.

### Use of Your Personal Data
The Company uses Personal Data to:
* Provide and maintain the Service
* Manage Your Account
* Fulfill contracts and provide requested services
* Contact You for updates or informative communications
* Manage user requests
* Conduct business transfers
* Analyze and improve the Service

We may share Your Personal Data with Service Providers, affiliates, and business partners to fulfill these purposes.

### Retention of Your Personal Data
Screenshots and visual diffs are retained typically for 60-120 days, controlled by your chosen service plan. You can manually manage or delete these within your Account. Build metadata and related usage data may be retained indefinitely for analytical and operational purposes.

### Data Transfers Outside the EU
Your Personal Data may be processed at the Company's offices and other locations outside the EU. We use Standard Contractual Clauses or similar safeguards to ensure Your data remains secure.

### User Rights Under GDPR
If You are an EU resident, you have the right to:
* Access, rectify, or delete Your Personal Data
* Restrict or object to data processing
* Data portability

To exercise these rights, contact us at contact@vizdiff.io.

If you accidentally include sensitive or personal data in screenshots and wish it removed, immediately contact us at contact@vizdiff.io to request its deletion.

### Legal Basis for Processing
Our legal basis for processing Your data is primarily contractual necessity, as collecting Your Personal Data is essential to deliver the Vizdiff screenshot testing Service.

### Complaints
You have the right to lodge a complaint with your local data protection supervisory authority if you believe we have violated your privacy rights under GDPR.

### Disclosure of Your Personal Data
We may disclose Personal Data if required by law or in good faith to protect and defend our rights or to protect user safety.

### Security of Your Personal Data
We strive to use commercially acceptable means to protect Your Personal Data but cannot guarantee absolute security.

### Children's Privacy
Our Service does not address anyone under 13. If You become aware Your child has provided Personal Data, please contact us immediately.

### Links to Other Websites
We do not control third-party sites linked from Our Service. Review their privacy policies carefully.

### Changes to this Privacy Policy
We will notify You of Privacy Policy updates via email or prominent Service notice. Changes take effect upon posting.

### Contact Us
For questions about this Privacy Policy or your data:
* Email: contact@vizdiff.io
`

export default function PrivacyPolicy(): JSX.Element {
  return (
    <>
      <Head>
        <title>Privacy Policy - vizdiff.io</title>
        <meta name="description" content="Privacy Policy for the vizdiff.io service" />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg">
          <Box
            sx={{
              textAlign: "left",
              maxWidth: "1200px",
            }}
          >
            <Box
              className="privacy-policy"
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
