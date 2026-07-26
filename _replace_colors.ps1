$dir = "C:\Users\Admin\dockulot-clinicsystem"

$replacements = @(
    "sky-700","amber-700",
    "sky-600","amber-600",
    "sky-500","amber-500",
    "sky-400","amber-400",
    "sky-300","amber-300",
    "sky-200","amber-200",
    "sky-100","amber-100",
    "sky-50","amber-50",
    "sky-800","amber-800",
    "sky-900","amber-900",
    "slate-700","neutral-700",
    "slate-600","neutral-600",
    "slate-500","neutral-500",
    "slate-400","neutral-400",
    "slate-300","neutral-300",
    "slate-200","neutral-200",
    "slate-100","neutral-100",
    "slate-50","neutral-50",
    "slate-800","neutral-800",
    "slate-900","neutral-900",
    "cyan-600","amber-600",
    "cyan-700","amber-700",
    "cyan-500","amber-500",
    "teal-600","amber-600",
    "teal-700","amber-700",
    "emerald-500","amber-500",
    "emerald-600","amber-600",
    "emerald-700","amber-700",
    "blue-100","amber-100",
    "blue-200","amber-200",
    "blue-50","amber-50",
    "blue-500","amber-500",
    "blue-600","amber-600",
    "blue-700","amber-700",
    "blue-800","amber-800",
    "blue-300","amber-300",
    "blue-400","amber-400",
    "border-blue-","border-amber-",
    "bg-blue-","bg-amber-",
    "from-blue-","from-amber-",
    "to-blue-","to-amber-",
    "via-blue-","via-amber-",
    "text-blue-","text-amber-",
    "hover:bg-blue-","hover:bg-amber-",
    "hover:text-blue-","hover:text-amber-",
    "hover:border-blue-","hover:border-amber-",
    "hover:bg-sky-","hover:bg-amber-",
    "hover:text-sky-","hover:text-amber-",
    "hover:border-sky-","hover:border-amber-",
    "from-sky-","from-amber-",
    "to-sky-","to-amber-",
    "via-sky-","via-amber-",
    "from-cyan-","from-amber-",
    "to-cyan-","to-amber-",
    "via-cyan-","via-amber-"
)

$tsxFiles = Get-ChildItem -Recurse -Path "$dir\src\components" -Include "*.tsx","*.ts" -ErrorAction SilentlyContinue

for ($i = 0; $i -lt $replacements.Count - 2; $i += 2) {
    $from = $replacements[$i]
    $to = $replacements[$i+1]
    foreach ($file in $tsxFiles) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($null -ne $content -and $content.Contains($from)) {
            $newContent = $content.Replace($from, $to)
            Set-Content -Path $file.FullName -Value $newContent -NoNewline
            Write-Host "Replaced [$from -> $to] in $($file.Name)"
        }
    }
}