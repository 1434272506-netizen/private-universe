param(
    [ValidateRange(1024, 65515)][int]$Port = 8765,
    [switch]$NoBrowser,
    [ValidateSet('Auto', 'HttpListener', 'Tcp')][string]$Transport = 'Auto',
    [string]$Root = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
# Keep cmd's UTF-8 bootstrap ASCII; Windows PowerShell displays the Chinese UI.
try { $Host.UI.RawUI.WindowTitle = '我们的私家宇宙 · 花园正在等你' } catch { }
Write-Host '亲爱的，花园正在打开，请保留这个窗口。'
Write-Host '想退出时，直接关闭这个窗口就好。'
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar)
$rootPrefix = $rootPath + [IO.Path]::DirectorySeparatorChar
if (-not [IO.File]::Exists([IO.Path]::Combine($rootPath, 'index.html'))) {
    Write-Host '请先完整解压礼物包，再双击启动文件。' -ForegroundColor Yellow
    exit 1
}
$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js' = 'application/javascript; charset=utf-8'
    '.mjs' = 'application/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.manifest' = 'application/json; charset=utf-8'
    '.glb' = 'model/gltf-binary'
    '.gltf' = 'model/gltf+json'
    '.bin' = 'application/octet-stream'
    '.jpg' = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.png' = 'image/png'
    '.webp' = 'image/webp'
    '.svg' = 'image/svg+xml'
    '.mp3' = 'audio/mpeg'
    '.ogg' = 'audio/ogg'
    '.wav' = 'audio/wav'
    '.ico' = 'image/x-icon'
    '.woff2' = 'font/woff2'
    '.txt' = 'text/plain; charset=utf-8'
}
function Get-Reply([string]$Path, [string]$Method, [string]$Range) {
    $reply = @{ Status = 200; File = $null; Body = [byte[]]@(); Start = [long]0; Length = [long]0;
        Headers = @{ 'Cache-Control' = 'no-cache'; 'X-Content-Type-Options' = 'nosniff'; 'Content-Type' = 'text/plain; charset=utf-8' } }
    if ($Method -notin @('GET', 'HEAD')) {
        $reply.Status = 405; $reply.Headers['Allow'] = 'GET, HEAD'; return $reply
    }
    try {
        $decoded = [Uri]::UnescapeDataString($Path)
        if ($decoded.IndexOf([char]0) -ge 0 -or $decoded.Contains('\') -or $decoded.Contains(':') -or ($decoded.Split('/') -contains '..')) {
            $reply.Status = 403; return $reply
        }
        $relative = $decoded.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath([IO.Path]::Combine($rootPath, $relative))
        if ($file -ne $rootPath -and -not $file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            $reply.Status = 403; return $reply
        }
        if ([IO.Directory]::Exists($file)) { $file = [IO.Path]::Combine($file, 'index.html') }
        if (-not [IO.File]::Exists($file)) {
            # Only extensionless SPA routes fall back; missing models/scripts stay 404.
            if (-not [IO.Path]::GetExtension($relative) -and $relative -notmatch '^(assets|models|memories|textures)[\\/]') {
                $file = [IO.Path]::Combine($rootPath, 'index.html')
            } else { $reply.Status = 404; return $reply }
        }
        $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
        $reply.Headers['Content-Type'] = 'application/octet-stream'
        if ($mime.ContainsKey($extension)) { $reply.Headers['Content-Type'] = $mime[$extension] }
        $reply.Headers['Accept-Ranges'] = 'bytes'
        $reply.File = $file; $reply.Length = (Get-Item -LiteralPath $file).Length
        if ($Range) {
            $total = $reply.Length; $end = $total - 1
            if ($Range -notmatch '^bytes=(\d*)-(\d*)$' -or $total -eq 0 -or (-not $Matches[1] -and -not $Matches[2])) {
                $reply.Status = 416
            } elseif (-not $Matches[1]) {
                $suffix = [long]$Matches[2]
                if ($suffix -eq 0) { $reply.Status = 416 } else { $reply.Start = [Math]::Max(0, $total - $suffix) }
            } else {
                $reply.Start = [long]$Matches[1]
                if ($Matches[2]) { $end = [Math]::Min($end, [long]$Matches[2]) }
                if ($reply.Start -gt $end) { $reply.Status = 416 }
            }
            if ($reply.Status -eq 416) {
                $reply.File = $null; $reply.Length = 0; $reply.Headers['Content-Range'] = "bytes */$total"
            } else {
                $reply.Status = 206; $reply.Length = $end - $reply.Start + 1
                $reply.Headers['Content-Range'] = "bytes $($reply.Start)-$end/$total"
            }
        }
    } catch { $reply.Status = 400; $reply.File = $null; $reply.Length = 0 }
    return $reply
}
function Send-Body($Reply, [IO.Stream]$Stream, [string]$Method) {
    if ($Method -eq 'HEAD' -or -not $Reply.File) { return }
    $fileStream = [IO.File]::OpenRead($Reply.File)
    try {
        [void]$fileStream.Seek($Reply.Start, [IO.SeekOrigin]::Begin)
        $buffer = New-Object byte[] 65536; $left = $Reply.Length
        while ($left -gt 0) {
            $read = $fileStream.Read($buffer, 0, [int][Math]::Min($left, $buffer.Length))
            if ($read -eq 0) { break }
            $Stream.Write($buffer, 0, $read); $left -= $read
        }
    } finally { $fileStream.Dispose() }
}
$listener = $null; $tcp = $null; $mode = $null
try {
    for ($candidate = $Port; $candidate -lt $Port + 20; $candidate++) {
        if ($Transport -ne 'Tcp') {
            try {
                $listener = New-Object Net.HttpListener
                $listener.Prefixes.Add("http://127.0.0.1:$candidate/")
                $listener.Start(); $mode = 'HttpListener'; break
            } catch { if ($listener) { $listener.Close(); $listener = $null } }
        }
        # HTTP.sys URL ACLs can reject non-admin accounts. This native .NET
        # loopback fallback needs neither an install nor URL ACL/admin changes.
        if ($Transport -ne 'HttpListener') {
            try {
                $tcp = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate)
                $tcp.ExclusiveAddressUse = $true; $tcp.Start(32); $mode = 'Tcp'; break
            } catch { if ($tcp) { $tcp.Stop(); $tcp = $null } }
        }
    }
    if (-not $mode) { throw '本地端口暂时无法打开，请关闭旧花园窗口后重试。' }
    $url = "http://127.0.0.1:$candidate/"
    Write-Host "花园已经准备好：$url" -ForegroundColor Green
    Write-Host '请保留这个窗口。想退出花园时，直接关闭窗口即可。'
    if (-not $NoBrowser) {
        try { Start-Process $url } catch { Write-Host "浏览器未自动打开，请复制上面的地址到浏览器。" }
    }
    while ($true) {
        if ($mode -eq 'HttpListener') {
            $pending = $listener.GetContextAsync()
            while (-not $pending.IsCompleted) { [void]$pending.Wait(200) }
            $context = $pending.GetAwaiter().GetResult()
            try {
                $reply = Get-Reply $context.Request.Url.AbsolutePath $context.Request.HttpMethod $context.Request.Headers['Range']
                $response = $context.Response; $response.StatusCode = $reply.Status
                $response.ContentType = $reply.Headers['Content-Type']; $response.ContentLength64 = $reply.Length
                $response.Headers['X-Garden-Transport'] = $mode
                foreach ($key in $reply.Headers.Keys) { if ($key -ne 'Content-Type') { $response.Headers[$key] = $reply.Headers[$key] } }
                Send-Body $reply $response.OutputStream $context.Request.HttpMethod
            } catch { } finally { $context.Response.Close() }
        } else {
            if (-not $tcp.Pending()) { Start-Sleep -Milliseconds 20; continue }
            $client = $tcp.AcceptTcpClient(); $client.ReceiveTimeout = 5000; $client.SendTimeout = 10000
            try {
                $stream = $client.GetStream(); $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
                $first = $reader.ReadLine(); if (-not $first -or $first.Length -gt 8192) { continue }
                $parts = $first.Split(' '); if ($parts.Count -ne 3 -or -not $parts[1].StartsWith('/')) { continue }
                $headers = @{}; $size = $first.Length
                while ($true) {
                    $line = $reader.ReadLine(); if (-not $line) { break }
                    $size += $line.Length; if ($size -gt 16384) { throw 'Request too large' }
                    $colon = $line.IndexOf(':'); if ($colon -gt 0) { $headers[$line.Substring(0, $colon).Trim()] = $line.Substring($colon + 1).Trim() }
                }
                if ($headers['Host'] -notin @("127.0.0.1:$candidate", "localhost:$candidate")) { continue }
                $path = $parts[1].Split('?')[0]
                $reply = Get-Reply $path $parts[0] $headers['Range']
                $reason = @{200='OK';206='Partial Content';400='Bad Request';403='Forbidden';404='Not Found';405='Method Not Allowed';416='Range Not Satisfiable'}[$reply.Status]
                $head = "HTTP/1.1 $($reply.Status) $reason`r`nConnection: close`r`nContent-Length: $($reply.Length)`r`nX-Garden-Transport: $mode`r`n"
                foreach ($key in $reply.Headers.Keys) { $head += "${key}: $($reply.Headers[$key])`r`n" }
                $bytes = [Text.Encoding]::ASCII.GetBytes($head + "`r`n"); $stream.Write($bytes, 0, $bytes.Length)
                Send-Body $reply $stream $parts[0]; $stream.Flush(); $reader.Dispose()
            } catch { } finally { $client.Close() }
        }
    }
} catch {
    Write-Host ("花园暂时没有打开：" + $_.Exception.Message) -ForegroundColor Yellow
    exit 1
} finally {
    if ($listener) { $listener.Stop(); $listener.Close() }
    if ($tcp) { $tcp.Stop() }
}
