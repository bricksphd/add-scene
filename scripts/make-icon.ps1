Add-Type -AssemblyName System.Drawing
$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r, $r, 180, 90)
  $p.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $p.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90)
  $p.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $p.CloseFigure()
  return $p
}

$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0, 0)), ([System.Drawing.Point]::new(0, $size)), ([System.Drawing.Color]::FromArgb(255, 30, 41, 82)), ([System.Drawing.Color]::FromArgb(255, 88, 40, 140))
$g.FillPath($bg, (RoundRect 0 0 $size $size 48))

# controller body
$body = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 245, 250))
$g.FillPath($body, (RoundRect 36 82 184 100 50))
$g.FillEllipse($body, 30, 110, 62, 84)
$g.FillEllipse($body, 164, 110, 62, 84)

$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 40, 48, 90))
# d-pad
$g.FillRectangle($dark, 70, 116, 12, 38)
$g.FillRectangle($dark, 57, 129, 38, 12)
# buttons
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 120, 90))), 168, 112, 20, 20)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 90, 200, 140))), 192, 130, 20, 20)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 90, 160, 255))), 144, 130, 20, 20)
# start/select
$g.FillRectangle($dark, 108, 138, 14, 6)
$g.FillRectangle($dark, 134, 138, 14, 6)

$bmp.Save((Join-Path $PSScriptRoot '..\media\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
