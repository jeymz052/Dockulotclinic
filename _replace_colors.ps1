$root = "C:\Users\Admin\dockulot-clinicsystem"

$files = Get-ChildItem -Path "$root\app","$root\src" -Recurse -File -Include "*.ts","*.tsx","*.css"

$familyMap = @{
    "yellow"  = "gold"
    "amber"   = "gold"
    "orange"  = "gold"
    "slate"   = "neutral"
    "gray"    = "neutral"
    "zinc"    = "neutral"
    "stone"   = "neutral"
    "sky"     = "neutral"
    "blue"    = "neutral"
    "cyan"    = "neutral"
    "teal"    = "neutral"
    "emerald" = "neutral"
    "indigo"  = "neutral"
    "violet"  = "neutral"
    "purple"  = "neutral"
    "pink"    = "neutral"
    "rose"    = "neutral"
}

$literalMap = @{
    "#b8860b" = "#c99611"
    "#fbbf24" = "#d9ad2f"
    "#facc15" = "#e7c766"
    "#A16207" = "#855d0c"
    "#854D0E" = "#67490c"
    "#CA8A04" = "#a6760d"
    "#fefce8" = "#fcf9ef"
    "#fffbeb" = "#fcf9ef"
    "#fef9c3" = "#f8efd0"
    "#fde68a" = "#f1de9e"
    "#fef3c7" = "#f8efd0"
    "#f5fbff" = "#f7f7f5"
    "#f3f8ff" = "#f7f7f5"
    "#f0faff" = "#f7f7f5"
    "#f8fcff" = "#f7f7f5"
    "#dbeafe" = "#f0f0ed"
    "#e0f2fe" = "#f0f0ed"
    "#64748b" = "#4b4b47"
    "#075985" = "#111111"
    "#0369a1" = "#111111"
}

foreach ($file in $files) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path)
    $updated = $content

    foreach ($entry in $familyMap.GetEnumerator()) {
        $pattern = "(?<![A-Za-z0-9])$($entry.Key)-(?=\d{2,3}\b)"
        $updated = [regex]::Replace($updated, $pattern, "$($entry.Value)-")
    }

    foreach ($entry in $literalMap.GetEnumerator()) {
        $updated = $updated.Replace($entry.Key, $entry.Value)
    }

    if ($updated -ne $content) {
        [System.IO.File]::WriteAllText($path, $updated)
        Write-Host "Updated $path"
    }
}
