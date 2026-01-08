Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = "DataCenter_Automation_Platform_Architecture.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry('word/document.xml')
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()
$content -replace '<[^>]+>','' -replace '\s+', ' '
