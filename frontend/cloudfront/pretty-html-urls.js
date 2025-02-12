// pretty-html-urls.js - CloudFront Function to serve up .html files without the
// .html extension

"use-strict"
function handler(event) {
  var request = event.request
  var uri = request.uri
  if (uri.endsWith("/")) {
    request.uri += "index.html"
  } else if (!uri.endsWith(".html")) {
    request.uri += ".html"
  }

  return request
}
