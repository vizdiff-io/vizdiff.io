import { Alert, Box, Button, Container, Grid, TextField, Typography } from "@mui/material"
import { type JSX, useCallback, useMemo, useState } from "react"

import { Seo } from "@/components/Seo"
import { publicApiGet, publicApiPost } from "@/lib/apiMethods"
import { APP_URL } from "@/lib/environment"

type SetupStatus = {
  missing: string[]
  placeholders: string[]
}

export default function Setup(): JSX.Element {
  const [setupToken, setSetupToken] = useState("")
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [githubStatus, setGithubStatus] = useState<string | null>(null)
  const [s3Status, setS3Status] = useState<string | null>(null)
  const [sesStatus, setSesStatus] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState("")

  const setupHeaders = useMemo(
    () => (setupToken ? { "x-setup-token": setupToken } : undefined),
    [setupToken],
  )

  const loadStatus = useCallback(async () => {
    setStatusError(null)
    const [data, error] = await publicApiGet<SetupStatus>("/api/setup/status", setupHeaders)
    if (error || !data) {
      setStatusError(error?.message ?? "Failed to load setup status")
      return
    }
    setStatus(data)
  }, [setupHeaders])

  const validateGithub = useCallback(async () => {
    setGithubStatus(null)
    const [data, error] = await publicApiPost<{ ok: boolean; app?: { slug: string } }>(
      "/api/setup/github/validate",
      {},
      undefined,
      setupHeaders,
    )
    if (error || !data?.ok) {
      setGithubStatus(error?.message ?? "GitHub App validation failed")
      return
    }
    setGithubStatus(`GitHub App validated (${data.app?.slug ?? "ok"})`)
  }, [setupHeaders])

  const validateS3 = useCallback(async () => {
    setS3Status(null)
    const [data, error] = await publicApiPost<{ ok: boolean }>(
      "/api/setup/s3/validate",
      {},
      undefined,
      setupHeaders,
    )
    if (error || !data?.ok) {
      setS3Status(error?.message ?? "S3 validation failed")
      return
    }
    setS3Status("S3 validation succeeded")
  }, [setupHeaders])

  const sendTestEmail = useCallback(async () => {
    setSesStatus(null)
    const [data, error] = await publicApiPost<{ ok: boolean }>(
      "/api/setup/ses/test",
      { email: testEmail },
      undefined,
      setupHeaders,
    )
    if (error || !data?.ok) {
      setSesStatus(error?.message ?? "SES test email failed")
      return
    }
    setSesStatus("Test email sent")
  }, [setupHeaders, testEmail])

  return (
    <>
      <Seo title="VizDiff Setup" />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
          Self-Contained Setup
        </Typography>
        <Typography color="var(--text-secondary)" sx={{ mb: 4 }}>
          Use this page to validate your GitHub App, S3 bucket, and SES configuration.
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            GitHub App Configuration
          </Typography>
          <Typography color="var(--text-secondary)" sx={{ mb: 1 }}>
            Webhook URL: {APP_URL}/api/webhooks/github
          </Typography>
          <Typography color="var(--text-secondary)" sx={{ mb: 1 }}>
            Required permissions: Checks (Read & Write), Contents (Read), Pull requests (Read),
            Statuses (Read & Write)
          </Typography>
          <Typography color="var(--text-secondary)">
            Required events: check_suite, check_run
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            label="Setup token (optional)"
            value={setupToken}
            onChange={(event) => setSetupToken(event.target.value)}
            helperText="If SETUP_TOKEN is configured, enter it here."
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Button variant="outlined" onClick={() => void loadStatus()}>
            Check Setup Status
          </Button>
          {statusError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {statusError}
            </Alert>
          )}
          {status && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Missing: {status.missing.length ? status.missing.join(", ") : "none"} <br />
              Placeholders: {status.placeholders.length ? status.placeholders.join(", ") : "none"}
            </Alert>
          )}
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                GitHub App
              </Typography>
              <Button variant="contained" onClick={() => void validateGithub()}>
                Validate GitHub App
              </Button>
              {githubStatus && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {githubStatus}
                </Alert>
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                S3 Bucket
              </Typography>
              <Button variant="contained" onClick={() => void validateS3()}>
                Validate S3
              </Button>
              {s3Status && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {s3Status}
                </Alert>
              )}
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                SES Email
              </Typography>
              <TextField
                fullWidth
                label="Test email address"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={() => void sendTestEmail()}
                disabled={!testEmail}
              >
                Send Test Email
              </Button>
              {sesStatus && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {sesStatus}
                </Alert>
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </>
  )
}
