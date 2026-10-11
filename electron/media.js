const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { preset, selection } = require('./presets');

const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');

function run(exe, args, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { shell: false, windowsHide: true });
    let output = '';
    child.stdout.on('data', b => {
      output += b;
      log?.(b.toString());
    });
    child.stderr.on('data', b => log?.(b.toString()));
    child.once('error', reject);
    child.once('close', code =>
      code === 0 ? resolve(output) : reject(new Error(`${path.basename(exe)} failed (${code}). Review the output.`))
    );
  });
}

const literal = value => "'" + value.replaceAll("'", "''") + "'";

function powershell(script, log) {
  return run(
    ps,
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    log
  );
}

function firstRun(value) {
  const tasks = selection(preset(value).tasks);
  return `$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"') -Wait
  exit
}
if (Test-Path -LiteralPath (Join-Path $root 'completed.txt')) { exit }
$env:INSTALLSTREET_DATA_ROOT = $root
Write-Host 'InstallStreet: connect to the internet before continuing. Selected apps will now install.'
& (Join-Path $root 'InstallStreet.Cli.exe') --run '${tasks.join(',')}'
if ($LASTEXITCODE -eq 0) { Set-Content -LiteralPath (Join-Path $root 'completed.txt') -Value (Get-Date) }
else { Write-Host 'Some tasks failed. Run this script again to retry; logs are in StatusHQ.' }
Read-Host 'Press Enter to close'
`;
}

function answerFile() {
  return String.raw`<?xml version="1.0" encoding="utf-8"?>
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
      <RunSynchronous>
        <RunSynchronousCommand wcm:action="add">
          <Order>1</Order>
          <Description>Bypass Windows 11 System Requirements</Description>
          <Path>reg.exe add HKLM\SYSTEM\Setup\LabConfig /v BypassTPMCheck /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
        <RunSynchronousCommand wcm:action="add">
          <Order>2</Order>
          <Description>Bypass Secure Boot Check</Description>
          <Path>reg.exe add HKLM\SYSTEM\Setup\LabConfig /v BypassSecureBootCheck /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
        <RunSynchronousCommand wcm:action="add">
          <Order>3</Order>
          <Description>Bypass RAM Check</Description>
          <Path>reg.exe add HKLM\SYSTEM\Setup\LabConfig /v BypassRAMCheck /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
        <RunSynchronousCommand wcm:action="add">
          <Order>4</Order>
          <Description>Bypass CPU Check</Description>
          <Path>reg.exe add HKLM\SYSTEM\Setup\LabConfig /v BypassCPUCheck /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
        <RunSynchronousCommand wcm:action="add">
          <Order>5</Order>
          <Description>Bypass Storage Check</Description>
          <Path>reg.exe add HKLM\SYSTEM\Setup\LabConfig /v BypassStorageCheck /t REG_DWORD /d 1 /f</Path>
        </RunSynchronousCommand>
      </RunSynchronous>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">
      <OOBE>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>
        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC>
      </OOBE>
      <FirstLogonCommands>
        <SynchronousCommand wcm:action="add">
          <Order>1</Order>
          <Description>InstallStreet selected applications</Description>
          <CommandLine>powershell.exe -NoProfile -ExecutionPolicy Bypass -File %SystemDrive%\InstallStreet\RunPreset.ps1</CommandLine>
        </SynchronousCommand>
      </FirstLogonCommands>
    </component>
  </settings>
</unattend>`;
}

async function findRufus(root) {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Links/rufus.exe'),
    path.join(process.env.ProgramFiles || '', 'Rufus/rufus.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs/Rufus/rufus.exe')
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function buildMedia({ root, dataRoot, iso, oscdimg, value, log, runPowerShell = powershell, runCommand = run }) {
  value = preset(value);
  const job = path.join(dataRoot, 'Media', randomUUID());
  const media = path.join(job, 'source');
  await fs.mkdir(media, { recursive: true });
  log('Inspecting and copying Windows ISO…');

  // The mount is released even if validation or copying fails. Existing mounts are preserved.
  await runPowerShell(`$ErrorActionPreference='Stop'; $iso=${literal(iso)}; $owned=$false; try {
    $disk=Get-DiskImage -ImagePath $iso -ErrorAction SilentlyContinue
    if (!$disk -or !$disk.Attached) { $disk=Mount-DiskImage -ImagePath $iso -PassThru; $owned=$true }
    $volume=$disk | Get-Volume; $source=$volume.DriveLetter + ':\\'
    $image=Join-Path $source 'sources\\install.wim'; if (!(Test-Path -LiteralPath $image)) { $image=Join-Path $source 'sources\\install.esd' }
    $images=Get-WindowsImage -ImagePath $image
    foreach ($item in $images) {
      $info=Get-WindowsImage -ImagePath $image -Index $item.ImageIndex
      if ($info.Architecture -ne 9) { throw 'Only x64 Windows media is supported.' }
      $build=([version]$info.Version).Build
      if (($build -ge 22000) -ne (${value.windows} -eq 11) -or $build -lt 10240) { throw 'The ISO does not match the selected Windows version.' }
    }
    if (Test-Path -LiteralPath (Join-Path $source 'autounattend.xml')) { throw 'Use an original Windows ISO without an answer file.' }
    if (Test-Path -LiteralPath (Join-Path $source 'sources\\$OEM$')) { throw 'Use an original Windows ISO without OEM customizations.' }
    & robocopy.exe $source ${literal(media)} /E /R:1 /W:1 /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) { throw 'ISO copy failed.' }
  } finally { if ($owned) { Dismount-DiskImage -ImagePath $iso | Out-Null } }`, log);

  const payload = path.join(media, 'sources', '$OEM$', '$1', 'InstallStreet');
  await fs.mkdir(payload, { recursive: true });

  const files = [
    'InstallStreet.Cli.exe',
    'TaskRuntime.dll',
    'DisplayCity/DarkMode.dll',
    'DisplayCity/Wallpaper.dll',
    'DisplayCity/ConsumerFeatures.dll',
    'Files/showHiddenFiles.dll',
    'Files/showFileExtensions.dll',
    'VaultHouse/RunningIcon.dll',
    'VaultHouse/Appointer/desktopn.dll',
    'VaultHouse/Guards/LinkedInRemoval.dll',
    'VaultHouse/icons/.running/running.ico'
  ];

  for (const name of await fs.readdir(path.join(root, 'AppL'))) {
    if (name.endsWith('.dll')) files.push('AppL/' + name);
  }

  for (const file of files) {
    const dest = path.join(payload, file);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(root, file), dest);
  }

  await fs.writeFile(path.join(payload, 'preset.json'), JSON.stringify(value, null, 2));
  await fs.writeFile(path.join(payload, 'RunPreset.ps1'), '\uFEFF' + firstRun(value));
  await fs.writeFile(path.join(media, 'autounattend.xml'), answerFile());

  // Rufus preserves this answer file and does not replace it with its customization dialog.
  const panther = path.join(media, 'sources', '$OEM$', '$$', 'Panther');
  await fs.mkdir(panther, { recursive: true });
  await fs.writeFile(path.join(panther, 'unattend.xml'), answerFile());

  const bios = path.join(media, 'boot', 'etfsboot.com');
  const uefi = path.join(media, 'efi', 'microsoft', 'boot', 'efisys.bin');
  await fs.access(bios);
  await fs.access(uefi);

  const output = path.join(job, `InstallStreet-Windows-${value.windows}.iso`);
  log('Creating bootable ISO…');
  await runCommand(oscdimg, ['-m', '-o', '-u2', '-udfver102', `-bootdata:2#p0,e,b${bios}#pEF,e,b${uefi}`, media, output], log);

  if ((await fs.stat(output)).size === 0) {
    throw new Error('ISO creation produced an empty file.');
  }

  log('ISO ready: ' + output);
  return output;
}

async function ensureOscdimg(root, dataRoot, log, execute = run) {
  const output = await execute(path.join(root, 'OscdimgSetup.exe'), [dataRoot], log);
  const target = output.split(/\r?\n/).find(line => line.startsWith('OSCDIMG_PATH='))?.slice(13).trim();
  if (!target) throw new Error('Oscdimg setup did not return an installed tool.');
  await fs.access(target);
  return target;
}

module.exports = { buildMedia, firstRun, answerFile, literal, ensureOscdimg, findRufus };
