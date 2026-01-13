Add-Type -AssemblyName System.Drawing

function Create-Icon($size, $outputPath) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    
    # Emerald green color
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
    
    # Draw rounded rectangle
    $radius = [int]($size * 0.2)
    $gpath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $d = $radius * 2
    $gpath.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $gpath.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $gpath.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $gpath.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $gpath.CloseFigure()
    $graphics.FillPath($brush, $gpath)
    
    # Draw checkmark
    $penWidth = [float]($size * 0.12)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $pen.LineJoin = 'Round'
    
    $x1 = [float]($size * 0.25)
    $y1 = [float]($size * 0.5)
    $x2 = [float]($size * 0.42)
    $y2 = [float]($size * 0.67)
    $x3 = [float]($size * 0.75)
    $y3 = [float]($size * 0.33)
    
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    $graphics.DrawLine($pen, $x2, $y2, $x3, $y3)
    
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    Write-Host "Created $outputPath"
}

Create-Icon 16 "icons\icon16.png"
Create-Icon 48 "icons\icon48.png"
Create-Icon 128 "icons\icon128.png"

Write-Host "All icons created successfully!"

