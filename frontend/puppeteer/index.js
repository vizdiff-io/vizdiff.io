// const puppeteer = require("puppeteer")

// ;(async () => {
//   const browser = await puppeteer.launch()
//   const page = await browser.newPage()
//   await page.setViewport({ width: 1920, height: 1080 })

//   const url = "http://localhost:6006/?path=/story/button--primary"
//   console.log("navigating to", url)
//   await page.goto(url, { waitUntil: "networkidle0" })
//   console.log("waiting for button")
//   await page.screenshot({ path: "button.png" })

//   await browser.close()
// })()

const puppeteer = require("puppeteer")

;(async () => {
  // Create a browser instance
  const browser = await puppeteer.launch()

  // Create a new page
  const page = await browser.newPage()

  // Set viewport width and height
  await page.setViewport({ width: 1280, height: 720 })

  const website_url = "http://localhost:6006/?path=/story/button--primary"
  // "https://www.bannerbear.com/blog/how-to-convert-html-into-pdf-with-node-js-and-puppeteer/"

  // Open URL in current page
  await page.goto(website_url, { waitUntil: "networkidle0" })

  // Capture screenshot
  await page.screenshot({
    path: "screenshot.jpg",
  })

  // Close the browser instance
  await browser.close()
})()
