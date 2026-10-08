using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Text;
public static class InstallStreetTask
{
    private static bool verifiedByAdministrator;
    private const string CheckCommand = "$ErrorActionPreference='Stop'; try { $items=@(Get-AppxPackage -AllUsers -Name '*LinkedIn*' -ErrorAction Stop); if($items.Count -eq 0){Write-Output 'No installed LinkedIn Appx packages remain for any user.'; exit 0}; Write-Output 'Installed LinkedIn Appx packages need removal.'; exit 10 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
    private const string RemoveCommand = "$ErrorActionPreference='Stop'; try { Get-AppxPackage -AllUsers -Name '*LinkedIn*' -ErrorAction Stop | Remove-AppxPackage -AllUsers -ErrorAction Stop; if(@(Get-AppxPackage -AllUsers -Name '*LinkedIn*' -ErrorAction Stop).Count -ne 0){throw 'LinkedIn Appx packages remain after removal.'}; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
    private static bool IsAdmin()
    {
        using(WindowsIdentity identity=WindowsIdentity.GetCurrent())
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
    }
    private static ProcessStartInfo Command(string command)
    {
        return new ProcessStartInfo(Path.Combine(Environment.SystemDirectory,@"WindowsPowerShell\v1.0\powershell.exe"),
            "-NoProfile -NonInteractive -OutputFormat Text -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(command)));
    }
    public static int Execute(string root,string mode,Action<string> output)
    {
        if(mode!="Check" && mode!="Run") throw new ArgumentException("Mode must be Check or Run.");
        if(output==null) output=delegate(string line){};
        bool administrator=IsAdmin();
        if(mode=="Check")
        {
            if(administrator) return ScriptTaskRuntime.Capture(Command(CheckCommand),null,output);
            if(verifiedByAdministrator){output("LinkedIn removal was verified by the administrator task in this run.");return 0;}
            output("All-user LinkedIn removal requires administrator verification. Check only will not request elevation or remove apps.");
            return 10;
        }
        int result;
        if(administrator) result=ScriptTaskRuntime.Capture(Command(RemoveCommand),null,output);
        else
        {
            output("Requesting administrator permission to remove installed LinkedIn Appx packages for all users.");
            ProcessStartInfo start=Command(RemoveCommand);
            start.UseShellExecute=true; start.Verb="runas"; start.WindowStyle=ProcessWindowStyle.Hidden;
            try { using(Process process=Process.Start(start)){process.WaitForExit();result=process.ExitCode;} }
            catch(Win32Exception error){if(error.NativeErrorCode==1223){output("LinkedIn removal failed: administrator permission was canceled.");return 1;}throw;}
        }
        if(result==0){verifiedByAdministrator=true;output("Installed LinkedIn Appx packages removed and absence verified for all users.");}
        else output("LinkedIn removal failed with exit code " + result + ". No successful removal was recorded.");
        return result;
    }
}
