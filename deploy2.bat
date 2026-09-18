@echo off
cd /d C:\Users\Cem\Desktop\ottoman\web-esube
del /q sizes2.bat 2>nul
if exist dist rmdir /s /q dist
call npx vite build
echo --- dist ---
dir /b dist\assets\index-*.*
git add -A
git add -f dist
git -c core.safecrlf=false commit -F commit2-msg.txt
git log --oneline -1
git status --short
