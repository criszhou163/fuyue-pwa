Add-Type -AssemblyName System.Drawing
$sizes = @(180, 192, 512)
foreach ($size in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0c0d10'))
  $pad = [int]($size * .16)
  $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#d7fb83'), [float]($size * .02))
  $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#171b22'))), $pad, $pad, $size-2*$pad, $size-2*$pad)
  $g.DrawEllipse($pen, $pad, $pad, $size-2*$pad, $size-2*$pad)
  $font = New-Object System.Drawing.Font('Microsoft YaHei', [float]($size * .36), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d7fb83'))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString([string][char]0x8D74, $font, $brush, (New-Object System.Drawing.RectangleF(0,0,$size,$size)), $format)
  $name = if ($size -eq 180) {'icon-180.png'} else {"icon-$size.png"}
  $bmp.Save((Join-Path $PSScriptRoot "icons/$name"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $pen.Dispose(); $font.Dispose(); $brush.Dispose()
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'icons/icon-512.png') -Destination (Join-Path $PSScriptRoot 'icons/icon-maskable-512.png') -Force
