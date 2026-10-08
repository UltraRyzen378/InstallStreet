using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
internal static class RunningHelper
{
    private static int Main(string[] args)
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) return 1;
        if (args.Length > 0)
        {
            Console.WriteLine("RunningHelper.exe registers the InstallStreet .running icon for your account.");
            return args.Length == 1 && args[0] == "--help" ? 0 : 1;
        }
        try
        {
            string executable = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "InstallStreet.Cli.exe");
            using (Process process = Process.Start(new ProcessStartInfo(executable, "--register-icon") { UseShellExecute = false }))
            {
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}



