@echo off
cd /d C:\Users\Cem\Desktop\ottoman\web-esube
del /q commit2-msg.txt deploy2.bat push2.bat cleanup.bat 2>nul
git add -A
git -c core.safecrlf=false commit -m "Drop the helper scripts that slipped into the previous commit" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_016snPNpDy8yNyeYj8SeYtnV"
git push origin main
echo --- head ---
git log --oneline -3
git status --short
echo --- stray tracked ---
git ls-files | findstr /r "bat$ msg.txt$"
echo --- done ---
