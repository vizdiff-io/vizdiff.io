import Head from "next/head"
import Image from "next/image"
import { Inter } from "next/font/google"
import styles from "@/styles/Home.module.css"

const inter = Inter({ subsets: ["latin"] })

export default function Home() {
  return (
    <>
      <Head>
        <title>VizDiff.io</title>
        <meta
          name="description"
          content="Affordable screenshot testing platform for your projects."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <h1 className={styles.title}>Welcome to VizDiff.io</h1>
        <p className={styles.description}>
          The affordable screenshot testing platform for your projects.
        </p>
        <a href="#" className={`${styles.button} ${styles["button-primary"]}`}>
          Get Started
        </a>
      </main>
    </>
  )
}
