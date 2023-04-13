import Head from "next/head"
import { useRouter } from "next/router"

const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/auth/github/callback`)
const scope = "repo"

export default function Login() {
  const router = useRouter()

  const handleConnectToGitHub = () => {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`
    router.push(authUrl)
  }

  return (
    <>
      <Head>
        <title>VizDiff - Login</title>
        <meta name="description" content="Login to VizDiff" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <h1>Login to VizDiff</h1>
        <button onClick={handleConnectToGitHub}>Connect to GitHub</button>
      </main>
    </>
  )
}
