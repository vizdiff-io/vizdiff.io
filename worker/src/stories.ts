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

  // Take screenshot with browser mutex
  const screenshotPath = path.join(tmpDir, `${storyId}.png`)
  let screenshot: Buffer | undefined
  const tempPath1 = path.join(tmpDir, `${storyId}-temp1.png`)
  const tempPath2 = path.join(tmpDir, `${storyId}-temp2.png`)
  // Start with temp1 as the destination for the first screenshot
  let previousScreenshotPath = tempPath1
  let currentScreenshotPath = tempPath2

  await browserMutex.acquire()
  try {
    // Navigate to the story
    const storyUrl = `http://localhost:${port}/iframe.html?id=${storyId}`
    log.debug(`Navigating to story URL: ${storyUrl}`)
    await browser.url(storyUrl)

    // Wait for the story to load
    log.debug("Waiting for story to load...")
    await waitForStorybookToLoad(browser)

    // --- Screenshot Stabilization Logic ---
    log.debug("Taking initial screenshot for stabilization...")
    let previousScreenshotBuffer = await takeScreenshotWithRetry(browser, previousScreenshotPath)
    screenshot = previousScreenshotBuffer // Initialize screenshot with the first capture

    const startTime = Date.now()
    let stabilized = false

    while (Date.now() - startTime < SCREENSHOTS_UNCHANGED_TIMEOUT_MS) {
      await browser.pause(SCREENSHOT_INTERVAL_MS)
      log.debug(`Taking next screenshot for stabilization check...`)
      let currentScreenshotBuffer: Buffer
      try {
        currentScreenshotBuffer = await takeScreenshotWithRetry(browser, currentScreenshotPath)
      } catch (err) {
        log.error(
          err,
          `Failed to take screenshot during stabilization loop. Using previous screenshot.`,
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
        screenshot = currentScreenshotBuffer // Update final screenshot candidate
        // Swap paths for next iteration
        ;[previousScreenshotPath, currentScreenshotPath] = [
          currentScreenshotPath,
          previousScreenshotPath,
        ]
        continue // Skip stability check for this iteration
      }

      const diffRatio = diffImagesNoMask(previousPng, currentPng)
      log.debug(`Stability check for story ${storyId}: diffRatio=${diffRatio}`)

      // Always update the baseline and final screenshot candidate to the latest capture
      previousScreenshotBuffer = currentScreenshotBuffer
      screenshot = currentScreenshotBuffer
      // Swap paths for the next potential iteration
      ;[previousScreenshotPath, currentScreenshotPath] = [
        currentScreenshotPath,
        previousScreenshotPath,
      ]

      if (diffRatio < IMAGE_UNCHANGED_THRESHOLD) {
        log.info(
          `Screenshot for story ${storyId} stabilized after ${Date.now() - startTime}ms with diffRatio=${diffRatio}`,
        )
        stabilized = true
        break // Stable state reached, exit loop
      }
      // Not stable yet, loop continues with updated buffer/paths
    } // End while loop

    // --- Post-Loop Handling ---
    if (!stabilized && Date.now() - startTime >= SCREENSHOTS_UNCHANGED_TIMEOUT_MS) {
      log.warn(
        `Screenshot for story ${storyId} did not stabilize within ` +
          `${SCREENSHOTS_UNCHANGED_TIMEOUT_MS}ms. Using last captured screenshot.`,
      )
      // No action needed here, 'screenshot' already holds the last buffer captured
    }

    // Rename the final selected screenshot file (now in previousScreenshotPath) to the official path
    // 'screenshot' buffer variable holds the corresponding data
    log.debug(
      `Using final screenshot buffer (${screenshot.byteLength} bytes) located at ${previousScreenshotPath}`,
    )
    await fsPromises.rename(previousScreenshotPath, screenshotPath)
    await fsPromises.unlink(currentScreenshotPath).catch((err: unknown) => {
      log.error(err, `Failed to delete unused temp screenshot ${currentScreenshotPath}`)
    })
    // --- End Screenshot Logic ---
  } finally {
    // Release browser mutex
    browserMutex.release()
  }

  // Upload screenshot to S3
  const screenshotKey = `projects/${projectId}/screenshots/${uploadId}/${storyId}.png`
  log.debug(`Uploading screenshot to S3: ${screenshotKey}`)
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: screenshotKey,
      Body: screenshot,
      ContentType: "image/png",
    }),
  )
  const newImageUrl = `https://${bucket}.s3.amazonaws.com/${screenshotKey}`
  log.info(`Successfully uploaded screenshot ${screenshotKey} to S3 (${screenshot.length} bytes)`)

  let changeStatus: TestResultStatus = "new"
  let baselineImageUrl = newImageUrl
  let diffImageUrl: string | undefined
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
        await downloadImage(s3Client, bucket, baselineKey, baselinePath)

        // Load the new and baseline PNG images
        const newImageBuffer = await fsPromises.readFile(screenshotPath)
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
  testResult.diffImageUrl = diffImageUrl ?? null
  testResult.diffRatio = diffRatio
  testResult.changeStatus = changeStatus
  await testResultTable.save(testResult)
  log.debug(
    `Successfully saved test result record ${testResult.id} (${testResult.name}) for build #${buildNumber}`,
  )

  return testResult
}

async function downloadImage(
  s3Client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
): Promise<void> {
  const resp = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!resp.Body) {
    throw new Error("Empty baseline response")
  }

  const writeStream = fs.createWriteStream(filePath)
  await new Promise<void>((resolve, reject) => {
    if (resp.Body instanceof Readable) {
      resp.Body.pipe(writeStream).on("finish", resolve).on("error", reject)
    } else {
      reject(new Error("Baseline response body is not a readable stream"))
    }
  })
}

async function waitForStorybookToLoad(browser: Browser): Promise<void> {
  await browser.waitUntil(
    async () => {
      // eslint-disable-next-line prefer-arrow-callback
      const ready = await browser.execute(function () {
        // @ts-expect-error: this is javascript
        // eslint-disable-next-line
        return !!(window.__STORYBOOK_PREVIEW__ && window.__STORYBOOK_PREVIEW__.ready)
      })
      log.debug(`Storybook ready: ${ready}`)
      return ready
    },
    {
      timeout: 10 * 1000,
      timeoutMsg: "Story failed to load within 10s",
      interval: 100,
    },
  )

  // TASK: Use WebDriver BiDi to wait for "network quiescence"

  // Sleep for an additional fixed delay after network requests have completed
  await browser.pause(500)
}

async function takeScreenshotWithRetry(
  browser: Browser,
  screenshotPath: string,
  maxRetries = 3,
): Promise<Buffer<ArrayBuffer>> {
  const RETRY_DELAY_MS = 1000

  for (let i = 0; i < maxRetries; i++) {
    try {
      log.debug(`Taking screenshot: ${screenshotPath}`)
      return await browser.saveScreenshot(screenshotPath)
    } catch (err) {
      if (i === maxRetries - 1) {
        throw err
      }
      log.warn(`Screenshot attempt ${i + 1} failed, waiting and retrying...`)
      await browser.pause(RETRY_DELAY_MS)
    }
  }
  throw new Error("Screenshot failed after max retries")
}

function getStoryName(story: Story): string {
  // Stories have `title` fields that look like "stories/components/NewProjectDialog" and `name`
  // fields based on the exported variable name in the file. Strip the leading "stories/" (if any)
  // and append "/${name}" to get the full story name, then trim down to the last 255 characters.
  const { name, title } = story
  const cleanedTitle = title.startsWith("stories/") ? title.slice(8) : title
  return `${cleanedTitle}/${name}`.slice(-255)
}
