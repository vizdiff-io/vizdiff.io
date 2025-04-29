import { Container, Box } from "@mui/material"
import Head from "next/head"
import React, { type JSX } from "react"
import ReactMarkdown from "react-markdown"

import MarkdownCode from "@/components/MarkdownCode"
import { MarketingLayout } from "@/components/NavBody"

const markdown = `
Getting Started with VizDiff 🚀
===

> **Prerequisite**
> A GitHub repository that already builds a Storybook (e.g. build-storybook job) and write access to that repo.

## 1. Sign in to VizDiff with GitHub

Press the "Get Started" button in the top right corner of the VizDiff website. You will be redirected to GitHub to sign in using your GitHub account, and then redirected back to your VizDiff projects dashboard.

## 2. Create a Project and Install the GitHub App

To start using VizDiff, you need to install the GitHub App and create a project from an existing GitHub repository. Press the "Add project" button on the projects dashboard, and if you are not already a member of a GitHub organization that has installed the VizDiff GitHub App, you will see a button to install the GitHub App. Press the button and follow the instructions to install the app for any organizations you want to use VizDiff with.

> **Least-Privilege Tip**
> Install the app only on the organizations that need visual testing. You can expand access later by pressing "Add project" again then the "Configure GitHub App" button.

![Add project button → dialog with Install App → GitHub install screen → choose organization(s) → back to dialog, pick the repository.](/docs/new-project-first-time.gif)

## 3. Add \`VIZDIFF_PROJECT_TOKEN\` as a GitHub secret

After the dialog closes you land on the new project's page—copy the Project Token.

In GitHub, go to Settings → Secrets → Actions → New secret and paste the token. (Repo-level is sufficient.)

Or for power users using the GitHub CLI, in your repo directory run:

\`\`\`bash
gh secret set VIZDIFF_PROJECT_TOKEN -b"PASTE-TOKEN-HERE"
\`\`\`

## 4. Update your GitHub Actions workflow

The [VizDiff GitHub Action](https://github.com/marketplace/actions/vizdiff-upload) provides an easy way to upload your Storybook build to VizDiff.

Your GitHub Actions workflow must build your Storybook and output the build results to a directory. Most commonly, a \`npm run build-storybook\` command will create a \`storybook-static\` directory with the build results. After this step, insert the upload step:

\`\`\`yaml
- name: Upload Storybook to VizDiff
  uses: vizdiff-io/upload-action@v1
  with:
    project-token: \${{ secrets.VIZDIFF_PROJECT_TOKEN }}
    storybook-dir: ./storybook-static  # optional, defaults to ./storybook-static
\`\`\`

## 5. Trigger the workflow & watch the status check

Trigger your workflow, for example by opening a pull request. When the upload step completes an additional GitHub status check will appear in the pull request. This check will stay in the "Queued" state while screenshots are generated, and if there are new or changed screenshots the check will stay in the "Queued" state until approved or denied. (If there are no changes, the check will immediately transition to "Success".)

Click the "..." button then "Details" on the check to see a summary of the changes and a link to the VizDiff review page. Click the link to open the VizDiff review page.

![Rendering storybook components → 4 changes to review.](/docs/pr-check-queued.gif)

## 7. Screenshot review on vizdiff.io

The VizDiff review page shows a list of all screenshots that were generated for the build. They are sorted by status with "New" screenshots first, followed by "Changed", then "Unchanged". Clicking on a screenshot will open a dialog showing different comparison views for that screenshot.

![VizDiff review page, Build #42](/docs/build-page.png)

Press left and right on the keyboard or the arrow buttons to navigate between screenshots. Switch between "Old", "New", "Diff", and "2-Up" tabs to see different views of the screenshots. In the "Diff" view, changes are highlighted in green. Only some views are available for "New" screenshots.

![Screenshot details dialog, Diff view](/docs/details-diffview.png)

## 8. Approve or Deny the build

Once you've reviewed all screenshots, you can approve or deny the build. Pressing either button will immediately update the GitHub status check to "Success" or "Failure" respectively.

## 9. Next Steps—Generate Your First Diff

The first run of any branch establishes a baseline; every screenshot will show "New" status. To see real diffs, push another commit to the same PR or open a new branch that starts from a commit with approved screenshots.

Only files that change between the two Storybook builds will appear as Changed in VizDiff.

## 10. Troubleshooting FAQ

- I get a "403 Forbidden during upload" error when uploading screenshots.

  This is likely because the \`VIZDIFF_PROJECT_TOKEN\` is not set or incorrect. Check that the secret is set in the repository and that the workflow is using the correct secret name.

* The upload action is failing to find the \`storybook-static\` directory.

  Make sure that your workflow is building your Storybook and outputting the build results to a directory. The default directory is \`storybook-static\` (in the root of the repository), but you can change it by setting the \`storybook-dir\` parameter.
`

export default function Documentation(): JSX.Element {
  return (
    <>
      <Head>
        <title>Documentation - vizdiff.io</title>
        <meta
          name="description"
          content="Documentation and getting started guide for the vizdiff.io service"
        />
      </Head>
      <MarketingLayout>
        <Container maxWidth="lg" sx={{ px: { xs: 0, md: 3 } }}>
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
                "& h2": { marginBottom: "0.5em", marginTop: "2em" },
                "& h3": { marginBottom: "0.5em" },
                "& h4": { marginBottom: "0.25em" },
                "& img": { width: { xs: "100%", md: "75%" }, margin: "auto", display: "block" },
                "& blockquote": {
                  backgroundColor: "var(--bg-secondary)",
                  margin: "1em",
                  padding: "10px 10px 1px 10px",
                },
                "& code": {
                  fontSize: "1rem",
                },
                "& pre code": {
                  fontSize: { xs: "0.75rem !important", md: "0.875rem !important" },
                },
              }}
            >
              <ReactMarkdown components={{ code: MarkdownCode }}>{markdown}</ReactMarkdown>
            </Box>
          </Box>
        </Container>
      </MarketingLayout>
    </>
  )
}
