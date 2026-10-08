using System;
using System.IO;
using System.Reflection;
public static class InstallStreetTask
{
    public static int Execute(string root, string mode, Action<string> output)
    {
        if (mode != "Check" && mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        Assembly library = Assembly.LoadFrom(Path.Combine(root, @"AppL\GoogleChrome.dll"));
        bool installed = (bool)library.GetType("GoogleChromeTask", true).GetMethod("IsInstalled").Invoke(null, null);
        if (output != null) output(installed ? "Chrome is installed." : "Chrome is not installed.");
        return installed ? 0 : 1;
    }
}
