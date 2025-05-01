import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import fs, { promises as fsPromises } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { PNG } from "pngjs"
import { ScreenshotTest, TestResult, type TestResultStatus } from "shared"
import type { Repository } from "typeorm"
import type { Browser } from "webdriverio"

import { diffImages, diffImagesNoMask } from "./images"
import { log } from "./log"

export interface Story {
  id: string
  name: string
  title: string
  importPath: string
  componentPath: string
  tags: string[]
}

export type StoryInfo = {
  story: Story
  screenshotTest: ScreenshotTest
  baseTestResult?: TestResult
  bucket: string
  tmpDir: string
  projectId: string
  uploadId: string
  port: number
  s3Client: S3Client
  testResultTable: Repository<TestResult>
  browser: Browser
}

// Create a mutex for browser access
const browserMutex = {
  locked: false,
  queue: [] as Array<() => void>,

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }
    await new Promise<void>((resolve) => this.queue.push(resolve))
  },

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) {
        next()
      }
    } else {
      this.locked = false
    }
  },
}

const SCREENSHOT_INTERVAL_MS = 500
const SCREENSHOTS_UNCHANGED_TIMEOUT_MS = 10 * 1000
const IMAGE_UNCHANGED_THRESHOLD = 0.001

/**
 * Navigates to a story, waits for it to stabilize, and saves a screenshot.
 * Uses a mutex to ensure only one browser operation happens at a time.
 * @param browser WebDriverIO browser instance
 * @param storyId The ID of the story to capture
 * @param port The port where the Storybook is being served locally
 * @param tempDir A temporary directory for stabilization screenshots
 * @param outputFilePath The final path to save the stabilized screenshot
 * @returns The path to the saved screenshot file (same as outputFilePath)
 */
export async function captureStableScreenshot(
  browser: Browser,
  storyId: string,
  port: number,
  tempDir: string,
  outputFilePath: string,
): Promise<string> {
  log.debug(`Capturing stable screenshot for story ${storyId}`)
  const tempPath1 = path.join(tempDir, `${storyId}-temp1.png`)
  const tempPath2 = path.join(tempDir, `${storyId}-temp2.png`)
  let previousScreenshotPath = tempPath1
  let currentScreenshotPath = tempPath2
  let finalScreenshotBuffer: Buffer | undefined

  await browserMutex.acquire()
  try {
    // Navigate to the story
    const storyUrl = `http://localhost:${port}/iframe.html?id=${storyId}` // Ensure port is used
    log.debug(`Navigating to story URL: ${storyUrl}`)
    await browser.url(storyUrl)

    // Wait for the story to load
    log.debug("Waiting for story to load...")
    await waitForStorybookToLoad(browser)

    // --- Screenshot Stabilization Logic ---
    log.debug("Taking initial screenshot for stabilization...")
    let previousScreenshotBuffer = await takeScreenshotWithRetry(browser, previousScreenshotPath)
    finalScreenshotBuffer = previousScreenshotBuffer // Initialize screenshot with the first capture

    const startTime = Date.now()
    let stabilized = false
    const MAX_ATTEMPTS = Math.ceil(SCREENSHOTS_UNCHANGED_TIMEOUT_MS / SCREENSHOT_INTERVAL_MS)
    let attempts = 0

    while (attempts < MAX_ATTEMPTS && Date.now() - startTime < SCREENSHOTS_UNCHANGED_TIMEOUT_MS) {
      attempts++
      await browser.pause(SCREENSHOT_INTERVAL_MS)
      log.debug(`Taking stabilization screenshot attempt ${attempts}/${MAX_ATTEMPTS}...`)

      let currentScreenshotBuffer: Buffer
      try {
        currentScreenshotBuffer = await takeScreenshotWithRetry(browser, currentScreenshotPath)
      } catch (err) {
        log.error(
          err,
          `Failed to take screenshot during stabilization attempt ${attempts}. Using previous screenshot.`,
        )
        break // Exit while loop, use the previously captured screenshot
      }

      // Compare the previous and current screenshots
      const previousPng = PNG.sync.read(previousScreenshotBuffer)
      const currentPng = PNG.sync.read(currentScreenshotBuffer)

      if (previousPng.width !== currentPng.width || previousPng.height !== currentPng.height) {
        log.error(
          `Screenshot dimensions changed from ${previousPng.width}x${previousPng.height} to ` +
            `${currentPng.width}x${currentPng.height} for story ${storyId}. Continuing stabilization check.`,
        )
        // Update the baseline for the next comparison
        previousScreenshotBuffer = currentScreenshotBuffer
        finalScreenshotBuffer = currentScreenshotBuffer // Update final screenshot candidate
        // Swap paths for next iteration
        ;[previousScreenshotPath, currentScreenshotPath] = [
          currentScreenshotPath,
          previousScreenshotPath,
        ]
        continue // Skip stability check for this iteration
      }

      const diffRatio = diffImagesNoMask(previousPng, currentPng)
      log.debug(
        `Stability check for story ${storyId}: diffRatio=${diffRatio} (attempt ${attempts}/${MAX_ATTEMPTS})`,
      )

      // Always update the baseline and final screenshot candidate to the latest capture
      previousScreenshotBuffer = currentScreenshotBuffer
      finalScreenshotBuffer = currentScreenshotBuffer
      // Swap paths for the next potential iteration
      ;[previousScreenshotPath, currentScreenshotPath] = [
        currentScreenshotPath,
        previousScreenshotPath,
      ]

      if (diffRatio < IMAGE_UNCHANGED_THRESHOLD) {
        log.info(
          `Screenshot for story ${storyId} stabilized after ${Date.now() - startTime}ms with diffRatio=${diffRatio} (attempt ${attempts})`,
        )
        stabilized = true
        break // Stable state reached, exit loop
      }

      // Not stable yet, check if we're approaching the timeout
      const timeRemaining = SCREENSHOTS_UNCHANGED_TIMEOUT_MS - (Date.now() - startTime)
      if (timeRemaining < SCREENSHOT_INTERVAL_MS) {
        log.warn(`Approaching timeout for story ${storyId} stabilization, using last screenshot`)
        break
      }
    } // End while loop

    // --- Post-Loop Handling ---
    if (!stabilized) {
      log.warn(
        `Screenshot for story ${storyId} did not stabilize within ` +
          `${SCREENSHOTS_UNCHANGED_TIMEOUT_MS}ms (${attempts} attempts). Using last captured screenshot.`,
      )
    }

    if (!finalScreenshotBuffer) {
      throw new Error(`Failed to capture any screenshot for story ${storyId}`)
    }

    // Rename the final selected screenshot file to the official path
    log.debug(
      `Using final screenshot buffer (${finalScreenshotBuffer.byteLength} bytes) located at ${previousScreenshotPath}`,
    )
    // Write the final buffer to the output path
    await fsPromises.writeFile(outputFilePath, finalScreenshotBuffer)

    // Clean up the other temp file
    await fsPromises.unlink(currentScreenshotPath).catch((err: unknown) => {
      log.warn(err, `Failed to delete unused temp screenshot ${currentScreenshotPath}`)
    })
    // --- End Screenshot Logic ---
  } finally {
    // Release browser mutex
    browserMutex.release()
  }
  log.info(`Stable screenshot saved to ${outputFilePath}`)
  return outputFilePath
}

export async function processStory({
  story,
  screenshotTest,
  baseTestResult,
  bucket,
  tmpDir,
  projectId,
  uploadId,
  port,
  s3Client,
  testResultTable,
  browser,
}: StoryInfo): Promise<TestResult> {
  const storyId = story.id
  log.info(`Processing story: ${storyId} (${story.name})`)

  const localScreenshotPath = path.join(tmpDir, `${storyId}.png`)
  const screenshotTempDir = path.join(tmpDir, "stabilization") // Subdir for temp files
  await fsPromises.mkdir(screenshotTempDir, { recursive: true })

  // Call captureStableScreenshot correctly here
  try {
    await captureStableScreenshot(browser, storyId, port, screenshotTempDir, localScreenshotPath)
  } catch (error) {
    log.error(error, `Failed to capture stable screenshot for story ${storyId}`)
    // Create a minimal failed TestResult record
    const name = getStoryName(story)
    const buildNumber = screenshotTest.buildNumber
    const testResult = new TestResult()
    testResult.name = name
    testResult.screenshotTest = screenshotTest
    testResult.storyId = storyId
    testResult.story = story
    testResult.changeStatus = "error" // Indicate failure
    await testResultTable.save(testResult)
    log.warn(
      `Saved error test result record for build #${buildNumber} story "${name}" (${storyId})`,
    )
    throw error // Re-throw to potentially fail the whole build
  }

  // Read the saved screenshot buffer for upload and comparison
  const screenshotBuffer = await fsPromises.readFile(localScreenshotPath)

  // Upload screenshot to S3
  const screenshotKey = `projects/${projectId}/screenshots/${uploadId}/${storyId}.png`
  log.debug(`Uploading screenshot to S3: ${screenshotKey}`)
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: screenshotKey,
      Body: screenshotBuffer,
      ContentType: "image/png",
    }),
  )
  const newImageUrl = `https://${bucket}.s3.amazonaws.com/${screenshotKey}`
  log.info(
    `Successfully uploaded screenshot ${screenshotKey} to S3 (${screenshotBuffer.length} bytes)`,
  )

  let changeStatus: TestResultStatus = "new"
  let baselineImageUrl: string | null = null
  let diffImageUrl: string | null = null
  let diffRatio = 0

  if (baseTestResult) {
    // Attempt to download baseline screenshot
    log.debug(
      `Base test result for story ${storyId}: ${JSON.stringify({
        id: baseTestResult.id,
        storyId: baseTestResult.storyId,
        hasScreenshotTest: !!baseTestResult.screenshotTest,
        screenshotTestId: baseTestResult.screenshotTest.id,
        uploadId: baseTestResult.screenshotTest.uploadId,
      })}`,
    )
    if (!baseTestResult.screenshotTest.uploadId) {
      log.warn(
        `Base test result for story ${storyId} has missing screenshotTest or uploadId reference`,
      )
      changeStatus = "new"
    } else {
      const baselineKey = `projects/${projectId}/screenshots/${baseTestResult.screenshotTest.uploadId}/${storyId}.png`
      baselineImageUrl = `https://${bucket}.s3.amazonaws.com/${baselineKey}`
      try {
        const baselinePath = path.join(tmpDir, `${storyId}-baseline.png`)
        await downloadImage({ s3Client, bucket, key: baselineKey, filePath: baselinePath })

        // Load the new and baseline PNG images
        const newImageBuffer = screenshotBuffer
        const baselineImageBuffer = await fsPromises.readFile(baselinePath)
        const newPng = PNG.sync.read(newImageBuffer)
        const baselinePng = PNG.sync.read(baselineImageBuffer)

        if (newPng.width !== baselinePng.width || newPng.height !== baselinePng.height) {
          log.warn(`Image dimensions mismatch for story ${storyId}`)
          changeStatus = "changed"
          diffRatio = 1
        } else {
          const diffRes = diffImages(newPng, baselinePng)
          diffRatio = diffRes.diffRatio

          // Default threshold of 0.1% difference
          changeStatus = diffRatio < 0.001 ? "unchanged" : "changed"
          log.debug(`Diff ratio for story ${storyId}: ${diffRatio} (${changeStatus})`)

          // Write and upload the diff image
          const diffPath = path.join(tmpDir, `${storyId}-diff.png`)
          await fsPromises.writeFile(diffPath, PNG.sync.write(diffRes.diffMask))
          const diffKey = `projects/${projectId}/screenshots/${uploadId}/${storyId}-diff.png`
          log.debug(`Uploading diff image ${diffPath} to s3://${bucket}/${diffKey}`)
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: diffKey,
              Body: await fsPromises.readFile(diffPath),
              ContentType: "image/png",
            }),
          )
          diffImageUrl = `https://${bucket}.s3.amazonaws.com/${diffKey}`
          log.info(
            `Successfully uploaded diff image ${diffKey} to S3 (${diffRes.diffMask.data.byteLength} bytes)`,
          )
        }
      } catch (err) {
        log.warn(
          `Baseline screenshot not available for story ${storyId}: ${err instanceof Error ? err.message : String(err)}`,
        )
        changeStatus = "new"
      }
    }
  }

  // Create test result record
  const name = getStoryName(story)
  const buildNumber = screenshotTest.buildNumber
  log.debug(`Creating test result record for build #${buildNumber} story "${name}" (${storyId})`)
  const testResult = new TestResult()
  testResult.name = name
  testResult.screenshotTest = screenshotTest
  testResult.storyId = storyId
  testResult.story = story
  testResult.newImageUrl = newImageUrl
  testResult.baselineImageUrl = baselineImageUrl
  testResult.diffImageUrl = diffImageUrl
  testResult.diffRatio = diffRatio
  testResult.changeStatus = changeStatus
  await testResultTable.save(testResult)
  log.debug(
    `Successfully saved test result record ${testResult.id} (${testResult.name}) for build #${buildNumber}`,
  )

  return testResult
}

interface DownloadImageArgs {
  s3Client: S3Client
  bucket: string
  key: string
  filePath: string
  timeoutMs?: number
}

async function downloadImage({
  s3Client,
  bucket,
  key,
  filePath,
  timeoutMs = 30 * 1000,
}: DownloadImageArgs): Promise<void> {
  const resp = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!resp.Body) {
    throw new Error("Empty baseline response")
  }

  const writeStream = fs.createWriteStream(filePath)
  await new Promise<void>((resolve, reject) => {
    let isSettled = false

    const handleSettled = (err?: Error) => {
      if (isSettled) {
        return
      }
      isSettled = true
      clearTimeout(timeout)

      // Clean up resources
      if (resp.Body instanceof Readable) {
        resp.Body.destroy()
      }

      // Complete the promise
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    }

    const timeout = setTimeout(() => {
      handleSettled(new Error(`Download timeout for image ${key}`))
    }, timeoutMs)

    if (resp.Body instanceof Readable) {
      resp.Body.pipe(writeStream)
        .on("finish", () => handleSettled())
        .on("error", (err) => handleSettled(err))
    } else {
      handleSettled(new Error("Baseline response body is not a readable stream"))
    }

    // Handle the case where the writeStream errors
    writeStream.on("error", (err) => handleSettled(err))
  })
}

async function waitForStorybookToLoad(browser: Browser): Promise<void> {
  const STORYBOOK_LOAD_TIMEOUT = 10 * 1000
  const POST_LOAD_DELAY = 500

  log.debug(`Waiting for Storybook to be ready with ${STORYBOOK_LOAD_TIMEOUT}ms timeout`)
  await browser.waitUntil(
    async () => {
      try {
        // eslint-disable-next-line prefer-arrow-callback
        const ready = await browser.execute(function () {
          // @ts-expect-error: this is javascript
          // eslint-disable-next-line
          return !!(window.__STORYBOOK_PREVIEW__ && window.__STORYBOOK_PREVIEW__.ready)
        })
        log.debug(`Storybook ready: ${ready}`)
        return ready
      } catch (err) {
        log.error(err, "Error checking Storybook ready state")
        return false
      }
    },
    {
      timeout: STORYBOOK_LOAD_TIMEOUT,
      timeoutMsg: `Story failed to load within ${STORYBOOK_LOAD_TIMEOUT / 1000}s`,
      interval: 100,
    },
  )

  // TASK: Use WebDriver BiDi to wait for "network quiescence"

  // Sleep for an additional fixed delay for final stabilization
  // log.debug(`Pausing for ${POST_LOAD_DELAY}ms final stabilization delay`)
  await browser.pause(POST_LOAD_DELAY)
}

async function takeScreenshotWithRetry(
  browser: Browser,
  screenshotPath: string,
  maxRetries = 3,
  timeoutMs = 10 * 1000, // 10 second timeout per attempt
): Promise<Buffer<ArrayBuffer>> {
  const RETRY_DELAY_MS = 1000

  return await new Promise<Buffer<ArrayBuffer>>((resolve, reject) => {
    let isSettled = false
    let timeoutId: NodeJS.Timeout | null = null

    const handleSettled = (result?: Buffer<ArrayBuffer>, err?: Error) => {
      if (isSettled) {
        return
      }
      isSettled = true

      // Clear the timeout if it exists
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // Resolve or reject based on result/error
      if (err) {
        reject(err)
      } else if (result) {
        resolve(result)
      } else {
        reject(new Error("No result and no error (should never happen)"))
      }
    }

    // Set timeout for the entire operation
    timeoutId = setTimeout(() => {
      handleSettled(
        undefined,
        new Error(`Screenshot timed out after ${timeoutMs}ms for ${screenshotPath}`),
      )
    }, timeoutMs)

    // Execute screenshot with retries
    const attemptScreenshot = async () => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          log.debug(`Taking screenshot: ${screenshotPath} (attempt ${i + 1}/${maxRetries})`)
          const result = await browser.saveScreenshot(screenshotPath)
          handleSettled(result)
          return
        } catch (err) {
          if (i === maxRetries - 1 || isSettled) {
            // Last retry or already settled (e.g. timeout occurred)
            handleSettled(undefined, err instanceof Error ? err : new Error("Screenshot failed"))
            return
          }
          log.warn(`Screenshot attempt ${i + 1} failed, waiting and retrying...`)
          await browser.pause(RETRY_DELAY_MS)
        }
      }
      // This should never be reached due to the error handling above
      handleSettled(undefined, new Error("Screenshot failed after max retries"))
    }

    // Start the screenshot process
    attemptScreenshot().catch((err: unknown) => {
      log.error(err, `Unhandled error in screenshot process for ${screenshotPath}`)
      handleSettled(undefined, err instanceof Error ? err : new Error(String(err)))
    })
  })
}

function getStoryName(story: Story): string {
  // Stories have `title` fields that look like "stories/components/NewProjectDialog" and `name`
  // fields based on the exported variable name in the file. Strip the leading "stories/" (if any)
  // and append "/${name}" to get the full story name, then trim down to the last 255 characters.
  const { name, title } = story
  const cleanedTitle = title.startsWith("stories/") ? title.slice(8) : title
  return `${cleanedTitle}/${name}`.slice(-255)
}
