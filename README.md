# InstallStreet

Open InstallStreet.exe to launch the Electron desktop window. Run InstallStreet attempts
the complete setup; tasks that are already configured are skipped. Retry setup
attempts the complete setup again. Check only performs detection without changes.
Open logs opens StatusHQ. There is no task selection or deselection.

## Applications installed

Clicking **Run InstallStreet** attempts the full setup below. Existing working
installations are checked and skipped. Opening InstallStreet or running
**Check only** does not install these applications.

| Application / tool | Version or source | Installation task |
| --- | --- | --- |
| Windows Package Manager (WinGet) | Microsoft.WinGet.Client bootstrap | `winget` |
| Git | `Git.Git` through WinGet | `git` |
| GitHub CLI (`gh`) | `GitHub.cli` through WinGet | `gh` |
| Google Chrome | Official Google installer | `chrome` |
| OpenAI Codex desktop app | Microsoft Store product `9PLM9XGG6VKS` | `codex` |
| Rufus | `Rufus.Rufus` through WinGet | `rufus` |
| Visual Studio Code | `Microsoft.VisualStudioCode` through WinGet | `vscode` |
| Microsoft .NET 10 SDK | `Microsoft.DotNet.SDK.10`; includes the corresponding runtime | `dotnet10` |
| Roblox Player | `Roblox.Roblox` through WinGet | `roblox` |
| nvm-windows | `CoreyButler.NVMforWindows` through WinGet | `nvm-windows` |
| Node.js | LTS version installed and activated through nvm-windows | `nvm-windows` |
| npm | Bundled with the Node.js version installed by nvm-windows | `nvm-windows` |
| Dimmer | Nelson Pires 2.0.1, from the specified official ZIP | `dimmer` |
| Python | Python 3.14 through `Python.Python.3.14`; existing working 3.14+ environments are skipped | `python` |
| pip | Included with Python; repaired with `ensurepip` when needed | `python` |
| NirSoft IconsExtract | Official NirSoft portable ZIP | `iconsextract` |
| iTunes desktop | Apple standalone x64 installer 12.13.8.3, not Microsoft Store | `itunes` |
| iCloud desktop | Legacy Apple standalone installer 7.18.0.22, not Microsoft Store | `icloud` |
| iLoader | Official nab138/iloader GitHub release 2.3.6 x64 MSI; runs after iTunes | `iloader` |

WinGet bootstrap also installs the **NuGet PowerShell package provider** and
**Microsoft.WinGet.Client PowerShell module** when needed. WinGet repair and
application installers can install their required framework dependencies.
StorageSense.exe is the bundled maintenance companion. Electron is bundled with InstallStreet itself, rather than installed as a
separate application. **PowerShell and Command Prompt are existing Windows
tools**; InstallStreet creates their desktop shortcuts.

iTunes and iCloud use direct Apple downloads, with pinned SHA256 checks and
Apple Authenticode signature verification before installation. Store versions do
not count as the requested desktop installations. Apple's current iCloud download
is Store-only; this task attempts legacy standalone iCloud 7.18.0.22 and reports an
installation or verification failure if it is incompatible with the PC. It never
falls back to the Store. [Apple's current download instructions](https://support.apple.com/en-us/103232).

iLoader is downloaded only from [its official repository](https://github.com/nab138/iloader),
with a pinned release checksum. InstallStreet installs the application; Apple ID
sign-in, device pairing, and sideloading are performed by the user inside iLoader.

## Other setup tasks

These tasks change settings, create shortcuts, or remove an application; they
are separate from the application installation list above.

| Task | Behavior | Compiled library |
| --- | --- | --- |
| LinkedIn removal | Removes installed LinkedIn Appx packages for all users | `VaultHouse/Guards/LinkedInRemoval.dll` |
| Promoted-app preference | Sets `SilentInstalledAppsEnabled` to DWORD `0` for the effective user | `DisplayCity/ConsumerFeatures.dll` |
| Wallpaper | Sets `C:\Windows\Web\Wallpaper\Theme1\img4.jpg` | `DisplayCity/Wallpaper.dll` |
| Dark mode | Enables dark mode for Windows and apps | `DisplayCity/DarkMode.dll` |
| Hidden files | Shows hidden files in File Explorer | `Files/showHiddenFiles.dll` |
| File extensions | Shows file extensions in File Explorer | `Files/showFileExtensions.dll` |
| Desktop shortcuts | Creates or repairs shortcuts for installed desktop apps, PowerShell, and Command Prompt | `VaultHouse/Appointer/desktopn.dll` |
| Running log icon | Registers the `.running` file icon | `VaultHouse/RunningIcon.dll` |

InstallStreet loads each task DLL directly. Chrome contains C# installation logic.
The other installer/settings DLLs embed the PowerShell task implementation at
build time and share TaskRuntime.dll. workers/task.ps1 is their editable source;
the built task DLLs do not read that file at runtime. Settings and the icon apply
to the effective administrator account. The application requires elevation at startup.

The former batch group/utility entries are compiled libraries too:
__init__.dll, AppL/init.dll, DisplayCity/init.dll, Files/__set__/applyChanges.dll,
workers/WhereAppL/whereappl.dll, VaultHouse/Guards/AdminRights.dll, and
VaultHouse/build-running-helper.dll. DLLs are loaded by a .NET host; double-click
InstallStreet.exe to start the app. There are no batch files in the project.

## Command line

```
InstallStreet.Cli.exe --check
InstallStreet.Cli.exe --run all
InstallStreet.Cli.exe --run chrome,codex
InstallStreet.Cli.exe --register-icon
InstallStreet.Cli.exe --retry
InstallStreet.Cli.exe --help
```

CLI task IDs allow individual integrations. The Electron window always runs the complete
catalog. Codex, Rufus, and nvm-windows include WinGet as a prerequisite. Failed
dependencies block dependent tasks; unrelated tasks continue. CLI --retry retries
failed or pending tasks from the latest run. The window's Retry setup reruns setup.

## Logs

Each run gets a StatusHQ/run-... folder with live .running logs, renamed .done
or .failed after execution and verification. Successful logs are retained.
latest.tsv tracks current/pending results; summary.tsv records completed sessions.
A lock prevents overlapping runs. Interrupted session logs are finalized on the
next run. --check does not create logs or change settings.

## Build and tests

Use the installed .NET Framework C# compiler through the build script:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File VaultHouse\build.ps1
InstallStreet.Cli.exe --self-test
npm run test:ui
```

The build compiles all DLLs and executables in a staging folder before publishing.
Previous artifacts are retained under tmp/build for processes still using them.
Generated DLLs, executables, logs, and temporary files are ignored by Git.
Runner/bridge tests use fixtures. Electron UI smoke tests perform read-only detection without installations or settings changes.
Actual installations require a separate end-to-end run.

WinGet uses Microsoft.WinGet.Client and Repair-WinGetPackageManager -Force -Latest
for bootstrap and dependency resolution. Chrome uses the official Google installer
and verifies its signature. Rufus uses WinGet package Rufus.Rufus. nvm-windows uses
CoreyButler.NVMforWindows, then installs and activates Node.js LTS with bundled npm.
A conflicting standalone Node installation is reported; it is not uninstalled.
Network and Store availability can affect installation. Settings restoration and
multi-user management are not included.

Microsoft bootstrap reference:
https://learn.microsoft.com/en-us/windows/package-manager/winget/

## Electron interface

The interface is in electron/index.html, styles.css, and renderer.js. main.js
runs the desktop window, while preload.js exposes a limited bridge to the DLL
runner through InstallStreet.Cli.exe. No task selection is exposed.

Install dependencies with npm install, build the backend with npm run build:tasks,
and launch with npm start or InstallStreet.exe. Test with npm test and npm run
test:ui. The Electron dependency is locked in package-lock.json.

InstallStreet.exe is a small launcher for the local Electron runtime. Keep the
node_modules folder beside it when using this development build. Packaged releases include the Electron runtime and DLL backend.


Rufus and VS Code are only ready when their desktop shortcuts point to the
installed executable. Missing or incorrect shortcuts are repaired without
reinstalling an existing app. Shortcuts use the actual Windows desktop location,
including a redirected/OneDrive desktop. .NET 10 installs the SDK (which includes
the corresponding runtime). Roblox uses the Roblox.Roblox WinGet package.


VaultHouse/Appointer/desktopn.dll creates or repairs desktop shortcuts immediately
for installed Chrome, Codex, Rufus, VS Code, and Roblox Player. Invoke it through
InstallStreet.Cli.exe --run desktop-apps. It also runs during every complete setup.
Missing apps are left for their installation tasks. Roblox installation now also
requires a valid Roblox Player desktop shortcut, including its launch arguments.


IconsExtract is included through AppL/IconsExtract.dll. It downloads NirSoft's
official portable ZIP to install under %LOCALAPPDATA%\InstallStreet\Apps\IconsExtract,
keeps the included documentation, and creates an IconsExtract desktop shortcut.
The desktopn helper also repairs that shortcut for existing installations.
Official download: https://www.nirsoft.net/utils/iconsext.html


## Distributable releases

`npm run dist` builds the DLL backend, then creates:

- `dist/InstallStreet-1.3.0-x64.msi`: Windows Installer with desktop and Start menu shortcuts.
- `dist/InstallStreet-1.3.0-x64.zip`: extract anywhere and run InstallStreet.exe without installing InstallStreet.

Both include Electron and all task DLLs. Node.js, npm, the source repository, and
build tools are not needed to run either release. The MSI installs InstallStreet;
it does not automatically run app-installation tasks. Open InstallStreet and run
setup when ready. Actual task installation still requires its downloads/network.

### Fresh Windows PCs

Use the release MSI or extract the entire portable ZIP on Windows 11 x64 (Intel
or AMD). Do not copy only InstallStreet.exe or StorageSense.exe, and do not use
the small source-development launcher from the repository as a release.
Visual Studio, Visual C++ build tools, Git, gh, Node.js, Python, a .NET SDK, and
PowerShell 7 are not prerequisites. The backend uses Windows' built-in .NET
Framework 4.x and Windows PowerShell 5.1. Administrator permission and internet
access are required for setup. Microsoft Store access is needed for Codex.
Native ARM64 and 32-bit releases are not currently provided.

WinGet is detected independently of PATH and bootstrapped when missing. The
bootstrap installs its NuGet provider and Microsoft.WinGet.Client module and
registers the default PowerShell Gallery repository if absent. Task processes
use a process-only execution-policy override; they do not change the user's or
machine's saved execution policy. Organization-enforced policies can still block
setup and are reported as failures.

`VaultHouse/verify-fresh-pc.ps1` checks packaged runtime assets and backend
assemblies, then probes the bundled Electron/Node runtime with a Windows-only
PATH, cleared developer environment variables, and missing Git/gh fixtures.
Release builds run this check. It does not install apps or run maintenance, and
it is a dependency-isolation check rather than a clean Windows VM test.

Packaged application logs, downloads, and profile data are kept in
%APPDATA%/InstallStreet so installation files can remain read-only. Portable here
means no InstallStreet installation is required; setup tasks still change the PC
and store application data in your user profile. The MSI is not a portable file.

Run VaultHouse/verify-msi.ps1 to inspect MSI metadata and required payload files.
The release binaries are unsigned; no signing certificate is configured.

### Auto-update settings

Open **Settings** in InstallStreet to enable automatic checks at startup and
every six hours, automatic downloads, and automatic installation when idle.
All options default to off. Automatic installation requires its own confirmation
when enabled, then closes InstallStreet and runs the verified MSI after setup and
StorageSense finish. Manual Check now, Download, and Install now are available.
No app-installation or maintenance tasks are started by an InstallStreet update.

Updates use published stable releases from UltraRyzen378/InstallStreet. Drafts
and prereleases are excluded. MSI downloads must match the release SHA256SUMS.txt;
the administrator-only UpdateHelper verifies the hash again after the app closes.
Windows Installer never requests an automatic restart. Reopen InstallStreet from
the desktop or Start menu shortcut after updating. For portable ZIP users, this
installs an MSI copy and leaves the extracted folder unchanged.

Because the repository is private, save a fine-grained GitHub token with
**Contents: read** permission for this repository in Settings. It is encrypted
with Electron safeStorage for the current Windows account, never returned to the
renderer, and never included in releases or source control. This token is only
used by the updater; it does not configure or authenticate gh. Published releases
and repository access are required before checks can find an update.

Settings are stored in %APPDATA%/InstallStreet/update-settings.json for packaged
builds. Verified installers and update logs are under %APPDATA%/InstallStreet/Updates.
Development builds do not install updates.

Every setup run includes DisplayCity/Wallpaper.dll, setting the current user's
wallpaper to C:\Windows\Web\Wallpaper\Theme1\img4.jpg. It verifies the active
wallpaper, skips an existing match, and reports a missing image as a task failure.
Check only does not change wallpaper. Releases 1.0.1 include the wallpaper DLL.


The desktopn helper also creates PowerShell and Command Prompt desktop shortcuts
using the built-in Windows executables. Both open in your user profile folder.


Git (Git.Git) and GitHub CLI (GitHub.cli) are included in every setup run, through
AppL/Git.dll and AppL/GitHubCLI.dll. When gh is missing, the desktop interface
asks for a username and email to save in InstallStreet's local gh-profile.json.
It then shows a separate warning before optionally setting Git's global user.name
and user.email. Declining the warning leaves Git config unchanged; the local
profile remains saved. Skipping the profile still installs all applications.
No gh authentication or credential files are changed. gh config does not provide
username/email settings; the saved profile is an InstallStreet preference.
CLI-only runs install the tools without prompting for or changing Git identity.


Every run includes ConsumerFeatures.dll, setting HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager\SilentInstalledAppsEnabled to DWORD 0.
The task verifies the value and DWORD type. It does not uninstall existing apps,
disable Store updates, or restart Windows. A restart may be needed. This is the
specific current-user registry preference; it is not a guarantee against every
Windows promotion or future feature-update changes.


Dimmer 2.0.1 uses the exact supplied ZIP URL, preserves its bundled documentation,
installs under %LOCALAPPDATA%\InstallStreet\Apps\Dimmer, and creates a desktop
shortcut. It is not launched or added to startup automatically.
Python uses Python.Python.3.14 and verifies the interpreter and pip. Existing
working Python 3.14+ environments are skipped; missing pip is repaired.
LinkedInRemoval.dll runs Get-AppxPackage -AllUsers '*LinkedIn*' | Remove-AppxPackage
-AllUsers inside the administrator-required setup session. It verifies absence and reports UAC
cancellation as failure. Check only detects packages without uninstalling. This removes
installed Appx registrations, not provisioned packages for future accounts.


InstallStreet requires administrator access for every desktop and CLI session.
Windows launch manifests require elevation for the GUI, CLI, and compatibility
helper. The Electron startup gate also prevents npm/development launches from
opening the interface without administrator access. Canceling UAC stops startup.
Electron renderer sandboxing stays enabled. Per-user settings apply to the
effective administrator account; entering another account's credentials changes
which account receives those settings. Developer smoke tests and CLI checks must
now be launched from an elevated terminal. DLL and packaging verification can
still inspect binaries without launching the application.



## GitHub release automation

The Windows releases workflow builds and verifies the MSI, portable ZIP, admin
manifests, and SHA-256 checksums, then creates a draft GitHub release. It never
runs the setup tasks on the build machine. Draft releases are reviewed and
published from the repository's Releases page.

For a release, update the version in package.json and package-lock.json, commit
and push main, then push the matching version tag (for example v1.0.5). A tag
whose version does not match package.json fails before building. Keep the MSI
upgrade code unchanged across versions.

Alternatively, run Windows releases from Actions on main. It uses the current
package version and refuses to reuse a tag pointing at another commit. GitHub
Actions must be enabled for the repository. The workflow uses the built-in
GITHUB_TOKEN; no personal token or signing credentials are required. Build jobs
have read-only repository access, and only the draft-release job can write.

## StorageSense sub-application

StorageSense.exe is the administrator-only Windows maintenance companion bundled
with InstallStreet. Keep it beside InstallStreet.exe and the runtime. Open it
directly, or click StorageSense in InstallStreet. It is separate from setup;
clicking Run InstallStreet never starts repairs or cleanup.

Available tools:

- DISM CheckHealth, ScanHealth, and AnalyzeComponentStore.
- DISM RestoreHealth, SFC verifyonly, and SFC scannow.
- Repair Windows: DISM RestoreHealth followed by SFC; stops on failure or a
  requested restart.
- CHKDSK online scan of the Windows volume, without forced dismount/reboot.
- DISM StartComponentCleanup without ResetBase.
- Windows Disk Cleanup with its normal category-selection dialog.
- Links to Windows storage settings, DISM/CBS logs, and per-operation output logs.

Run All runs every check, then DISM repair, SFC repair, component cleanup, and
Windows Disk Cleanup, with one confirmation before starting. DISM and SFC repair
each run once. The sequence stops on failure or a restart request; Disk Cleanup
still lets you choose which categories to delete.

Repair and component cleanup require confirmation. No operation starts on launch.
Maintenance and application setup cannot run concurrently. Commands are a fixed
allowlist; no arbitrary shell input is accepted. Output and percentage updates
appear live. Command completion does not prove that every detected issue was
repaired: review the output. Operation logs live under StorageSense/Logs in the
application data folder. Repair downloads depend on Windows Update configuration.
There is no automatic reboot, ResetBase, custom recursive file deletion, or
unattended clearing of Downloads or the Recycle Bin. Native maintenance operations
are tested with fixtures rather than run against the developer's Windows image.
