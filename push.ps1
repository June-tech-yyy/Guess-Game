# 把当前目录推到 GitHub。用法：
#   .\push.ps1 June-tech-yyy/same-frequency
#   .\push.ps1 https://github.com/June-tech-yyy/same-frequency.git
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Repo
)

$ErrorActionPreference = 'Stop'

if ($Repo -notmatch '^(https://|git@)') {
  $Repo = "https://github.com/$Repo.git"
}
$Repo = $Repo.TrimEnd('/')
if ($Repo -notlike '*.git') { $Repo = "$Repo.git" }

Write-Host "远程：$Repo" -ForegroundColor Cyan

git remote remove origin 2>$null
git remote add origin $Repo
git branch -M main

# 先探一下仓库在不在，避免把 404 报成认证问题
$probe = git ls-remote --heads origin 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "连不上仓库。两种可能：" -ForegroundColor Yellow
  Write-Host "  1) 仓库还没建 —— 先去 https://github.com/new 建一个空的（不要勾 README / .gitignore / license）"
  Write-Host "  2) 没登录 —— 第一次推会弹浏览器，按提示授权即可"
  Write-Host ""
  Write-Host $probe
  exit 1
}

git push -u origin main
Write-Host ""
Write-Host "完成。以后改完只要 git add -A; git commit -m '...'; git push" -ForegroundColor Green
