@ECHO OFF
SET "NODE_EXE=%~dp0\node.exe"
IF NOT EXIST "%NODE_EXE%" (
  SET "NODE_EXE=node"
)
SET "NPM_CLI_JS=%~dp0\node_modules\npm\bin\npm-cli.js"
"%NODE_EXE%" "%NPM_CLI_JS%" %*
