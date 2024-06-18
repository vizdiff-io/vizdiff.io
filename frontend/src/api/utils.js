export const createParams = (params) => {
  if (!params) return ""

  const toStr = (val) => {
    if (!val) {
      return ""
    }
    if (val instanceof Date) {
      return val.toISOString()
    }
    return val.toString()
  }
  const str = Object.keys(params).reduce((agg, key, idx) => {
    if (idx === 0) {
      agg += `?${key}=${toStr(params[key])}`
    } else {
      agg += `&${key}=${toStr(params[key])}`
    }
    return agg
  }, "")
  return str
}

export const domain = () => {
  return process.env.NODE_ENV === "development" ? "http://localhost:3001" : "TODO: REPLACE THIS"
}

export const handleError = async (res, convertToJSON = true) => {
  let json
  if (res.status > 399) {
    try {
      json = await res.json()
      return Promise.reject(new Error(json.message))
    } catch (err) {
      return Promise.reject(new Error("status code out of range"))
    }
  }

  if (convertToJSON) {
    try {
      json = await res.json()
    } catch (err) {
      return {}
    }
    return json
  } else {
    return res
  }
}
