@echo off
title Tender Package Builder
echo ========================================================
echo    Tender Package Builder - DevFest Contest 2026
echo ========================================================
echo Starting local web server on port 3000...
start "" "http://localhost:3000/"
node server.mjs
pause
