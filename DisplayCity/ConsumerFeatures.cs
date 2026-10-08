using System;
using Microsoft.Win32;
public static class InstallStreetTask
{
    private const string KeyPath = @"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager";
    private const string ValueName = "SilentInstalledAppsEnabled";
    private static bool IsConfigured()
    {
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(KeyPath))
        {
            if (key == null) return false;
            object value = key.GetValue(ValueName);
            return value is int && (int)value == 0 && key.GetValueKind(ValueName) == RegistryValueKind.DWord;
        }
    }
    public static int Execute(string root, string mode, Action<string> output)
    {
        if (mode != "Check" && mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        if (output == null) output = delegate(string line) { };
        if (IsConfigured()) { output("Promoted-app auto-install preference is already disabled."); return 0; }
        if (mode == "Check") { output("SilentInstalledAppsEnabled needs to be set to DWORD 0."); return 10; }
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(KeyPath))
        {
            if (key == null) throw new InvalidOperationException("Unable to open the ContentDeliveryManager registry key.");
            key.SetValue(ValueName, 0, RegistryValueKind.DWord);
        }
        output(@"Set HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager\SilentInstalledAppsEnabled to DWORD 0.");
        output("A Windows restart may be needed for the setting to take effect.");
        return 0;
    }
}
