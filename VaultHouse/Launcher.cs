using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Runtime.InteropServices;
internal static class Launcher
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int MessageBox(IntPtr owner, string text, string title, uint type);
    private static int Main(string[] args)
    {
        using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) return 1;
        try
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string electron = Path.Combine(root, @"node_modules\electron\dist\electron.exe");
            if (!File.Exists(electron)) throw new FileNotFoundException("This is the source-development launcher. On a new PC, install the release MSI or extract the complete portable ZIP and open its InstallStreet.exe. Developer tools are not required for releases.");
            ProcessStartInfo start = new ProcessStartInfo(electron, "\"" + root.TrimEnd('\\') + "\"");
            if (Array.IndexOf(args, "--smoke-test") >= 0) start.Arguments += " --smoke-test";
            start.WorkingDirectory = root; start.UseShellExecute = false; start.CreateNoWindow = true;
            Process.Start(start);
            return 0;
        }
        catch (Exception error) { MessageBox(IntPtr.Zero, error.Message, "InstallStreet", 0x10); return 1; }
    }
}


