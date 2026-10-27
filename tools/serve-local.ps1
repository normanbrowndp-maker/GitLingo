$ErrorActionPreference = "Stop"
$siteRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$separator = [System.IO.Path]::DirectorySeparatorChar
$rootPrefix = $siteRoot.TrimEnd($separator) + $separator
$allowedExtensions = @(".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".woff", ".woff2")
$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico" = "image/x-icon"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 8000)
$listener.Start()
Write-Host "GitLingo локально доступен на http://localhost:8000/"
Write-Host "Остановите сервер сочетанием Ctrl+C."

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while ($null -ne ($headerLine = $reader.ReadLine()) -and $headerLine.Length -gt 0) { }

      $statusCode = 200
      $statusText = "OK"
      $contentType = "text/plain; charset=utf-8"
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $method = ""
      $target = ""
      if ($requestLine -match "^(GET|HEAD)\s+(\S+)\s+HTTP/1\.[01]$") {
        $method = $Matches[1]
        $target = $Matches[2]
      } else {
        $statusCode = 405
        $statusText = "Method Not Allowed"
      }

      if ($statusCode -eq 200) {
        try {
          $requestPath = [System.Uri]::UnescapeDataString(([System.Uri]::new("http://localhost" + $target)).AbsolutePath)
          if ($requestPath -eq "/favicon.ico") {
            $body = [byte[]]@()
            $statusCode = 204
            $statusText = "No Content"
          } else {
            $relativePath = $requestPath.TrimStart("/").Replace("/", $separator)
            if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }
            $segments = $relativePath.Split($separator)
            $extension = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $siteRoot $relativePath))
            $insideRoot = $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
            $safeSegments = -not ($segments | Where-Object { $_.StartsWith(".") -or $_ -eq ".." })

            if ($insideRoot -and $safeSegments -and $allowedExtensions -contains $extension -and [System.IO.File]::Exists($filePath)) {
              $body = [System.IO.File]::ReadAllBytes($filePath)
              $contentType = $contentTypes[$extension]
            } else {
              $statusCode = 404
              $statusText = "Not Found"
            }
          }
        } catch {
          $statusCode = 404
          $statusText = "Not Found"
        }
      }

      $length = $body.Length
      $headerText = "HTTP/1.1 $statusCode $statusText`r`nContent-Type: $contentType`r`nContent-Length: $length`r`nX-Content-Type-Options: nosniff`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($method -ne "HEAD" -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
      $reader.Dispose()
      $stream.Dispose()
    } catch {
      # A disconnected browser request should not stop the local preview server.
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
