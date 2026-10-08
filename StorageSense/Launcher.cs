using System;
using System.Diagnostics;
using System.IO;
using System.Security.Principal;
using System.Runtime.InteropServices;
internal static class StorageSenseLauncher
{
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int MessageBox(IntPtr owner,string text,string title,uint type);
    private static int Main(string[] args)
    {
        using(WindowsIdentity identity=WindowsIdentity.GetCurrent())
            if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))return 1;
        try
        {
            string root=AppDomain.CurrentDomain.BaseDirectory;
            string electron=Path.Combine(root,@"node_modules\electron\dist\electron.exe");
            ProcessStartInfo start;
            if(File.Exists(electron)) start=new ProcessStartInfo(electron,"\""+root.TrimEnd('\\')+"\" --storage-sense");
            else
            {
                string host=Path.Combine(root,"InstallStreet.exe");
                if(!File.Exists(host))throw new FileNotFoundException("Keep StorageSense.exe beside InstallStreet.exe and the bundled runtime.");
                start=new ProcessStartInfo(host,"--storage-sense");
            }
            start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;
            Process.Start(start);return 0;
        }
        catch(Exception error){MessageBox(IntPtr.Zero,error.Message,"StorageSense",0x10);return 1;}
    }
}
