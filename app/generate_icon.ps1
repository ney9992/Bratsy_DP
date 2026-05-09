Add-Type -AssemblyName System.Drawing

$size = 256
$bmp  = New-Object System.Drawing.Bitmap($size, $size)
$g    = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$navy  = [System.Drawing.Color]::FromArgb(23, 95, 165)
$white = [System.Drawing.Color]::White
$dark  = [System.Drawing.Color]::FromArgb(12, 55, 103)

# Background
$g.FillRectangle((New-Object System.Drawing.SolidBrush($navy)), 0, 0, $size, $size)

$wb = New-Object System.Drawing.SolidBrush($white)
$db = New-Object System.Drawing.SolidBrush($dark)

# Chimneys
$g.FillRectangle($wb, 44,  58, 28, 58)
$g.FillRectangle($wb, 88,  38, 28, 78)
$g.FillRectangle($wb, 148, 52, 28, 64)

# Chimney caps (smoke puffs)
$g.FillEllipse($wb, 40,  46, 36, 20)
$g.FillEllipse($wb, 84,  26, 36, 20)
$g.FillEllipse($wb, 144, 40, 36, 20)

# Main building body
$bodyRect = New-Object System.Drawing.Rectangle(32, 116, 192, 108)
$g.FillRectangle($wb, $bodyRect)

# Roof line (slightly darker)
$g.FillRectangle($db, 32, 116, 192, 8)

# Windows row 1
foreach ($wx in @(46, 90, 134, 178)) {
    $g.FillRectangle($db, $wx, 132, 22, 22)
    # Window glare
    $glare = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 255, 255, 255))
    $g.FillRectangle($glare, $wx, 132, 10, 10)
}

# Windows row 2
foreach ($wx in @(46, 90, 178)) {
    $g.FillRectangle($db, $wx, 166, 22, 22)
}

# Door
$g.FillRectangle($db, 126, 166, 36, 58)
# Door knob
$g.FillEllipse($wb, 158, 192, 6, 6)

# Ground line
$g.FillRectangle($wb, 20, 224, 216, 4)

# Digital accent: small circuit dots on ground
foreach ($dx in @(30, 50, 70, 170, 190, 210)) {
    $g.FillEllipse($wb, $dx, 232, 6, 6)
}

$g.Dispose()

# Encode PNG into ICO container
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$ms.Dispose()
$bmp.Dispose()

$ico = New-Object System.IO.MemoryStream
$w   = New-Object System.IO.BinaryWriter($ico)
$w.Write([uint16]0)
$w.Write([uint16]1)
$w.Write([uint16]1)
$w.Write([byte]0)
$w.Write([byte]0)
$w.Write([byte]0)
$w.Write([byte]0)
$w.Write([uint16]1)
$w.Write([uint16]32)
$w.Write([uint32]$png.Length)
$w.Write([uint32]22)
$w.Write($png)
$w.Flush()

$outPath = Join-Path $PSScriptRoot "icon.ico"
[System.IO.File]::WriteAllBytes($outPath, $ico.ToArray())
$ico.Dispose()

Write-Host "Icon saved: $outPath"
