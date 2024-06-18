import { Typography } from "@mui/material"
import Head from "next/head"
import { NavBody } from "@/components/NavBody"

export default function Home() {
  return (
    <>
      <Head>
        <title>vizdiff.io</title>
        <meta name="description" content="Screenshot testing made easy." />
      </Head>
      <main>
        <NavBody>
          <Typography>Screenshot testing made easy.</Typography>
        </NavBody>
      </main>
    </>
  )
}
