import { Database } from "../database"
import { TestResult } from "../entity/TestResult"
import { getParamInt } from "../http"
import { DefaultRequest, DefaultResponse } from "../types"

export async function listByScreenshotTest(
  req: DefaultRequest,
  res: DefaultResponse,
): Promise<void> {
  const db = await Database()
  const id = getParamInt("id", req)
  const testResultsTable = db.getRepository(TestResult)
  const testResults = await testResultsTable.findBy({ screenshotTest: { id } })
  res.json(testResults)
}
