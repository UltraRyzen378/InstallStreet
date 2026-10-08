using System;
using System.Diagnostics;
using System.Security.Principal;
public static class AdminRights
{
    public static bool IsRunningAsAdmin()
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }
    public static int Run(string executable, string arguments)
    {
        ProcessStartInfo start = new ProcessStartInfo(executable, arguments) { UseShellExecute = true };
        if (!IsRunningAsAdmin()) start.Verb = "runas";
        using (Process process = Process.Start(start)) { process.WaitForExit(); return process.ExitCode; }
    }
}
