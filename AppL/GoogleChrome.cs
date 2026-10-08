using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Win32;

public static class GoogleChromeTask
{
    public static int Execute(string root, string mode, Action<string> output)
    {
        if (output == null) output = delegate(string line) { };
        if (mode != "Check" && mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        if (IsInstalled()) { output("chrome is ready."); return 0; }
        if (mode == "Check") { output("chrome needs setup."); return 10; }
        string directory = Path.Combine(Environment.GetEnvironmentVariable("INSTALLSTREET_DATA_ROOT") ?? root, "tmp", "ChromeInstaller", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        string installer = Path.Combine(directory, "ChromeSetup.exe");
        ProcessStartInfo download = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "curl.exe"),
            "--fail --location --retry 3 --retry-delay 3 --connect-timeout 30 --max-time 600 https://dl.google.com/chrome/install/latest/chrome_installer.exe --output \"" + installer + "\"");
        int result = Capture(download, output);
        if (result != 0) { output("Chrome download failed: " + result); return result; }
        string encodedInstaller = Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(installer));
        ProcessStartInfo verify = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
            "-NoProfile -NonInteractive -Command \"$s = Get-AuthenticodeSignature -LiteralPath ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('" + encodedInstaller + "'))); if ($s.Status -eq 'Valid' -and $s.SignerCertificate.Subject -match 'O=Google (LLC|Inc)') { exit 0 } else { Write-Error 'Chrome installer signature verification failed.'; exit 1 }\"");

        result = Capture(verify, output);
        if (result != 0) return result;
        output("Installing Google Chrome...");
        using (Process process = Process.Start(new ProcessStartInfo(installer, "/silent /install") { UseShellExecute = true }))
        {
            process.WaitForExit(); result = process.ExitCode;
        }
        if (result != 0 && result != 3010) { output("Chrome installer failed: " + result); return result; }
        if (result == 3010) output("Chrome requested a restart.");
        File.Delete(installer);
        return result;
    }
    public static bool IsInstalled()
    {
        foreach (string folder in new string[] {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) })
            if (!String.IsNullOrEmpty(folder) && File.Exists(Path.Combine(folder, @"Google\Chrome\Application\chrome.exe"))) return true;
        foreach (RegistryHive hive in new RegistryHive[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
            foreach (RegistryView view in new RegistryView[] { RegistryView.Registry32, RegistryView.Registry64 })
                using (RegistryKey basis = RegistryKey.OpenBaseKey(hive, view))
                using (RegistryKey key = basis.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"))
                {
                    string path = key == null ? null : key.GetValue("") as string;
                    if (!String.IsNullOrEmpty(path) && File.Exists(path.Trim('"'))) return true;
                }
        return false;
    }
    private static int Capture(ProcessStartInfo start, Action<string> output)
    {
        start.UseShellExecute = false; start.CreateNoWindow = true;
        start.RedirectStandardOutput = true; start.RedirectStandardError = true;
        using (Process process = Process.Start(start))
        {
            object gate = new object();
            Action<StreamReader> pump = delegate(StreamReader reader) {
                string line; while ((line = reader.ReadLine()) != null) { lock (gate) output(line); }
            };
            Task stdout = Task.Factory.StartNew(delegate { pump(process.StandardOutput); });
            Task stderr = Task.Factory.StartNew(delegate { pump(process.StandardError); });
            process.WaitForExit(); Task.WaitAll(stdout, stderr); return process.ExitCode;
        }
    }
}


