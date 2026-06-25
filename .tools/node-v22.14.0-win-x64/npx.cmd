@ECHO OFF
SET "NODE_EXE=%~dp0\node.exe"
IF NOT EXIST "%NODE_EXE%" (
  SET "NODE_EXE=node"
)
SET "NPX_CLI_JS=%~dp0\node_modules\npm\bin\npx-cli.js"
"%NODE_EXE%" "%NPX_CLI_JS%" %*
