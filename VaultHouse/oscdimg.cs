using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;

internal static class OscdimgSetup
{
    // Microsoft ADK download page: https://learn.microsoft.com/windows-hardware/get-started/adk-install
    private static int Main(string[] args)
    {
        if (args.Length != 1) return 1;
        Console.OutputEncoding = new UTF8Encoding(false);
        string data = Convert.ToBase64String(Encoding.Unicode.GetBytes(Path.GetFullPath(args[0])));
        string script = @"
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
function Find-Oscdimg {
  $roots=@((Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'))
  foreach($key in @('HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows Kits\Installed Roots')) {
    $item=Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
    if($item.KitsRoot10){$roots += $item.KitsRoot10}
  }
  foreach($root in $roots){$file=Join-Path $root 'Assessment and Deployment Kit\Deployment Tools\amd64\Oscdimg\oscdimg.exe';if(Test-Path -LiteralPath $file){return $file}}
}
$target=Find-Oscdimg
if(!$target){
  $data=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('__DATA__'))
  $folder=Join-Path $data ('tmp\ADK\'+[guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $installer=Join-Path $folder 'adksetup.exe'
  Write-Output 'Oscdimg is missing. Downloading Microsoft ADK Deployment Tools...'
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri 'https://go.microsoft.com/fwlink/?linkid=2289980' -OutFile $installer
  $signature=Get-AuthenticodeSignature -LiteralPath $installer
  if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)'){throw 'ADK installer Microsoft signature validation failed.'}
  Write-Output 'Installing Deployment Tools only...'
  $process=Start-Process -FilePath $installer -ArgumentList '/quiet /norestart /ceip off /features OptionId.DeploymentTools' -WindowStyle Hidden -Wait -PassThru
  if($process.ExitCode -notin @(0,3010)){throw ('ADK installation failed: '+$process.ExitCode+'. Installer: '+$installer)}
  if($process.ExitCode -eq 3010){Write-Output 'ADK requested a restart. No automatic restart will occur.'}
  $target=Find-Oscdimg
  if(!$target){throw 'ADK finished but Oscdimg was not found. Review ADK setup logs.'}
}
Write-Output ('OSCDIMG_PATH='+$target)
".Replace("__DATA__", data);
        try
        {
            var start = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
                "-NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(script)));
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;
            start.StandardOutputEncoding = Encoding.UTF8;
            start.StandardErrorEncoding = Encoding.UTF8;
            using (var process = Process.Start(start))
            {
                // Forward both streams explicitly: Electron captures this helper, not its child.
                Task stdout = Task.Factory.StartNew(delegate {
                    string line; while ((line = process.StandardOutput.ReadLine()) != null) Console.WriteLine(line);
                });
                Task stderr = Task.Factory.StartNew(delegate {
                    string line; while ((line = process.StandardError.ReadLine()) != null) Console.Error.WriteLine(line);
                });
                process.WaitForExit();
                Task.WaitAll(stdout, stderr);
                return process.ExitCode;
            }
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
