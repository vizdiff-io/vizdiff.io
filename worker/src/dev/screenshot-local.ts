import path from "node:path"
import { promises as fsPromises } from "node:fs"
import http from "node:http" // Needed for server type
import { remote, type Browser } from "webdriverio"
import { Command } from "commander"

// Import the new server utility
import { startStaticServer } from "../server"
import { log } from "../log" // Reuse existing logger
import { captureStableScreenshot, type Story } from "../stories"

interface CliOptions {
  storybookDir: string
  outputDir: string
}

// Placeholder for the actual index.json structure from Storybook v8
interface StorybookIndex {
  v: number
  entries: Record<string, Story>
}

async function main(options: CliOptions) {
  const storybookDir = path.resolve(options.storybookDir)
  const outputDir = path.resolve(options.outputDir)
  const indexJsonPath = path.join(storybookDir, "index.json")

  log.info(`Starting local screenshot generation`)
  log.info(`Storybook directory: ${storybookDir}`)
  log.info(`Output directory: ${outputDir}`)

  // 1. Validate inputs
  try {
    await fsPromises.access(storybookDir)
    await fsPromises.access(indexJsonPath)
  } catch (err) {
    log.error(
      err,
      `Invalid storybook directory: ${storybookDir}. Make sure it exists and contains index.json.`,
    )
    process.exit(1)
  }
  await fsPromises.mkdir(outputDir, { recursive: true })

  // 2. Read stories from index.json
  let stories: Record<string, Story>
  try {
    const indexJsonContent = await fsPromises.readFile(indexJsonPath, "utf-8")
    const indexData = JSON.parse(indexJsonContent) as StorybookIndex
    if (!indexData || typeof indexData.entries !== "object") {
      throw new Error('Invalid index.json format: missing "entries" object.')
    }
    stories = indexData.entries
    log.info(`Found ${Object.keys(stories).length} stories in index.json`)
  } catch (err) {
    log.error(err, `Failed to read or parse ${indexJsonPath}`)
    process.exit(1)
  }

  // 3. Start local web server using the utility
  let server: http.Server | undefined
  let port: number | undefined
  try {
    ;({ server, port } = await startStaticServer(storybookDir))
  } catch (err) {
    log.error(err, "Failed to start local static server")
    process.exit(1)
  }

  // 4. Initialize WebDriverIO
  let browser: Browser | undefined
  try {
    log.info("Initializing WebDriverIO...")
    browser = await remote({
      capabilities: {
        browserName: "chrome",
        "goog:chromeOptions": {
          // Add args like '--headless', '--window-size=1920,1080' if needed
          // args: ["--headless", "--window-size=1200,900"],
        },
      },
      logLevel: "warn", // Options: trace | debug | info | warn | error | silent
    })
    log.info("WebDriverIO initialized.")

    // Set viewport (optional, match worker if desired)
    // await browser.setViewport({ width: 1200, height: 900, devicePixelRatio: 1 });

    // 5. Process stories
    let successCount = 0
    let errorCount = 0
    const storyIds = Object.keys(stories)
    const tempDir = path.join(outputDir, ".tmp-screenshots") // Temp dir for stabilization images
    await fsPromises.mkdir(tempDir, { recursive: true })

    // Ensure browser is defined before loop
    if (!browser || !port) {
      throw new Error("Browser or server port not initialized")
    }

    for (const storyId of storyIds) {
      const story = stories[storyId]
      // Add null/undefined check for story
      if (!story) {
        log.error(`Story with id ${storyId} not found in index.json, skipping.`)
        errorCount++
        continue
      }

      // Construct a readable name like the worker does
      const cleanedTitle = story.title.startsWith("stories/") ? story.title.slice(8) : story.title
      const storyName = `${cleanedTitle}/${story.name}`.slice(-255)
      log.info(`Processing story: ${storyId} (${storyName})`)

      const outputFilePath = path.join(outputDir, `${storyId}.png`)

      try {
        // Call the refactored screenshot function
        await captureStableScreenshot(browser, storyId, port, tempDir, outputFilePath)

        log.info(`Screenshot saved to ${outputFilePath}`)
        successCount++
      } catch (err) {
        log.error(err, `Failed to process story ${storyId} (${storyName})`)
        errorCount++
      }
    }

    // Clean up temp directory
    await fsPromises.rm(tempDir, { recursive: true, force: true })

    log.info(`Finished processing ${storyIds.length} stories.`)
    log.info(`Success: ${successCount}, Errors: ${errorCount}`)
  } catch (err) {
    log.error(err, "An error occurred during screenshot generation")
  } finally {
    // 6. Cleanup
    log.info("Cleaning up...")
    if (browser) {
      try {
        await browser.deleteSession()
        log.info("WebDriverIO session deleted.")
      } catch (cleanupErr) {
        log.error(cleanupErr, "Error deleting WebDriverIO session")
      }
    }
    if (server) {
      server.close(() => {
        log.info("Local web server stopped.")
      })
    }
  }
}

const program = new Command()
program
  .name("screenshot")
  .description("Generate screenshots for a local storybook-static directory")
  .requiredOption("-s, --storybook-dir <path>", "Path to the storybook-static directory")
  .requiredOption("-o, --output-dir <path>", "Path to the output directory for screenshots")
  .action(main)

program.parse(process.argv)
