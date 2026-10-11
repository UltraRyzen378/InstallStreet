using System;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text.RegularExpressions;
internal static class UpdateHelper {
    private static int Main(string[] args) {
        using (WindowsIdentity identity=WindowsIdentity.GetCurrent())
            if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) return 1;
        string log=null;
        try {
            if (args.Length!=3 || !Regex.IsMatch(args[1],"^[a-fA-F0-9]{64}$")) return 1;
            string installer=Path.GetFullPath(args[0]);
            string allowed=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),@"InstallStreet\Updates")+Path.DirectorySeparatorChar;
            if (!installer.StartsWith(allowed,StringComparison.OrdinalIgnoreCase) || !Regex.IsMatch(Path.GetFileName(installer),@"^InstallStreet-\d+\.\d+\.\d+-x64\.msi$")) return 1;
            log=Path.Combine(Path.GetDirectoryName(installer),"update-helper.log");
            int pid;
            if (!Int32.TryParse(args[2],out pid)) return 1;
            try { using (Process parent=Process.GetProcessById(pid)) if (!parent.WaitForExit(60000)) throw new Exception("InstallStreet did not close. Update was not started."); }
            catch (ArgumentException) { }
            using (FileStream file=new FileStream(installer,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                using (SHA256 sha=SHA256.Create()) {
                    string hash=BitConverter.ToString(sha.ComputeHash(file)).Replace("-","");
                    if (!hash.Equals(args[1],StringComparison.OrdinalIgnoreCase)) throw new Exception("Update checksum changed. Installation was blocked.");
                }
                ProcessStartInfo start=new ProcessStartInfo(Path.Combine(Environment.SystemDirectory,"msiexec.exe"),"/i \""+installer+"\" /passive /norestart /L*v \""+Path.Combine(Path.GetDirectoryName(installer),"install.log")+"\"");
                start.UseShellExecute=false;
                int exitCode;
                using (Process child=Process.Start(start)) { child.WaitForExit(); exitCode=child.ExitCode; }
                if (exitCode==0 || exitCode==3010) {
                    string shortcut=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),@"Programs\InstallStreet\InstallStreet.lnk");
                    if (!File.Exists(shortcut)) throw new FileNotFoundException("The update installed, but the InstallStreet Start menu shortcut was not found.",shortcut);
                    ProcessStartInfo launch=new ProcessStartInfo(shortcut); launch.UseShellExecute=true; launch.WorkingDirectory=Path.GetDirectoryName(shortcut);
                    using (Process app=Process.Start(launch)) { }
                    File.WriteAllText(log,"Windows Installer exit code: "+exitCode+Environment.NewLine+"Launched the updated InstallStreet from its Start menu shortcut.");
                } else File.WriteAllText(log,"Windows Installer exit code: "+exitCode+Environment.NewLine+"InstallStreet was not reopened because installation failed.");
                return exitCode;
            }
        } catch (Exception error) { if (log!=null) File.WriteAllText(log,error.Message); return 1; }
    }
}
