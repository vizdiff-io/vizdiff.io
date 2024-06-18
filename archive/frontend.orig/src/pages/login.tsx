import { NavBody } from "@/components/NavBody"
import { useRouter } from "next/router"

const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const callbackUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_URL}/auth/github/callback`)
const scope = "repo,read:org"

export default function Login() {
  const router = useRouter()

  // Get the redirect URL from the query string
  const { redirect } = router.query
  const redirectUri =
    typeof redirect === "string" ? redirect : String(process.env.NEXT_PUBLIC_APP_URL)
  const state = encodeURIComponent(`redirect=${encodeURIComponent(redirectUri)}`)

  const handleConnectToGitHub = () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${callbackUri}&scope=${scope}&state=${state}`
    router.push(authUrl)
  }

  return (
    <NavBody>
      <h1>Login to vizdiff.io</h1>
      <button onClick={handleConnectToGitHub}>Login with GitHub</button>
    </NavBody>
  )
}
