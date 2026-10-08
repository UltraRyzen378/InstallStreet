using System;
using System.Diagnostics;
using System.IO;
public static class InstallStreetTask
{
    public static int Execute(string root, string mode, Action<string> output)
    {
        string compiler = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"Microsoft.NET\Framework64\v4.0.30319\csc.exe");
        if (mode == "Check") return File.Exists(compiler) ? 0 : 10;
        if (mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        return ScriptTaskRuntime.Capture(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
            "-NoProfile -ExecutionPolicy Bypass -File \"" + Path.Combine(root, @"VaultHouse\build.ps1") + "\""), null, output);
    }
}
