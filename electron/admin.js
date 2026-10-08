const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const query = '$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); if ($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { exit 0 } else { exit 1 }';
async function isAdministrator() {
  try { await exec(powershell, ['-NoProfile','-NonInteractive','-Command',query], { windowsHide: true, shell: false }); return true; }
  catch (error) { if (error.code === 1) return false; throw error; }
}
async function elevate(target, smoke) {
  const encoded = Buffer.from(target, 'utf16le').toString('base64');
  const command = `$target = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}')); try { Start-Process -FilePath $target ${smoke ? "-ArgumentList '--smoke-test'" : ''} -Verb RunAs -ErrorAction Stop | Out-Null; exit 0 } catch { [Console]::Error.WriteLine('Administrator permission was not granted.'); exit 1 }`;
  await exec(powershell, ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')], { windowsHide: true, shell: false });
}
async function ensureAdministrator(check, relaunch) {
  if (await check()) return true;
  await relaunch();
  return false;
}
module.exports = { isAdministrator, elevate, ensureAdministrator };
