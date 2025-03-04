import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import fs, { promises as fsPromises } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import { PNG } from "pngjs"
import { ScreenshotTest, TestResult, type TestResultStatus } from "shared"
import type { Repository } from "typeorm"
import type { Browser } from "webdriverio"

import { diffImages } from "./images"
import { log } from "./log"

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

interface Story {
  id: string
  name: string
  importPath: string
}

type StoryInfo = {
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
  let screenshot: Buffer
  await browserMutex.acquire()
  try {
    // Navigate to the story
    const storyUrl = `http://localhost:${port}/iframe.html?id=${storyId}`
    log.debug(`Navigating to story URL: ${storyUrl}`)
    await browser.url(storyUrl)

    // Wait for the story to load
    log.debug("Waiting for story to load...")
    await waitForStorybookToLoad(browser)

    // Take a screenshot
    screenshot = await takeScreenshotWithRetry(browser, screenshotPath)
    log.debug(`Successfully captured ${screenshot.length} byte screenshot: ${screenshotPath}`)
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
  const sanitizedName = story.name.substring(0, 255)
  log.debug(
    `Creating test result record for build #${screenshotTest.buildNumber} story "${sanitizedName}" (${storyId})`,
  )
  const testResult = new TestResult()
  testResult.name = sanitizedName
  testResult.screenshotTest = screenshotTest
  testResult.storyId = storyId
  testResult.newImageUrl = newImageUrl
  testResult.baselineImageUrl = baselineImageUrl
  testResult.diffImageUrl = diffImageUrl
  testResult.diffRatio = diffRatio
  testResult.changeStatus = changeStatus
  await testResultTable.save(testResult)
  log.debug(
    `Successfully saved test result record ${testResult.id} (${testResult.name}) for build #${screenshotTest.buildNumber}`,
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
  for (let i = 0; i < maxRetries; i++) {
    try {
      log.debug(`Taking screenshot: ${screenshotPath}`)
      return await browser.saveScreenshot(screenshotPath)
    } catch (err) {
      if (i === maxRetries - 1) {
        throw err
      }
      log.warn(`Screenshot attempt ${i + 1} failed, waiting and retrying...`)
      await browser.pause(1000)
    }
  }
  throw new Error("Screenshot failed after max retries")
}
