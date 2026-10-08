using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class InstallStreetTask
{
    public const string WallpaperPath = @"C:\Windows\Web\Wallpaper\Theme1\img4.jpg";
    private const uint GetWallpaper = 0x0073;
    private const uint SetWallpaper = 0x0014;
    private const uint UpdateProfileAndNotify = 0x0001 | 0x0002;
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetSystemParameter(uint action, uint length, StringBuilder value, uint flags);
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetSystemParameter(uint action, uint parameter, string value, uint flags);

    public static string CurrentWallpaper()
    {
        StringBuilder buffer = new StringBuilder(32768);
        if (!GetSystemParameter(GetWallpaper, (uint)buffer.Capacity, buffer, 0))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to read the desktop wallpaper.");
        return buffer.ToString();
    }
    public static int Execute(string root, string mode, Action<string> output)
    {
        if (mode != "Check" && mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        if (output == null) output = delegate(string text) { };
        bool configured = File.Exists(WallpaperPath) && String.Equals(CurrentWallpaper(), WallpaperPath, StringComparison.OrdinalIgnoreCase);
        if (configured) { output("Wallpaper is ready: " + WallpaperPath); return 0; }
        if (mode == "Check") { output("Wallpaper needs setup: " + WallpaperPath); return 10; }
        if (!File.Exists(WallpaperPath)) throw new FileNotFoundException("The requested wallpaper image was not found.", WallpaperPath);
        if (!SetSystemParameter(SetWallpaper, 0, WallpaperPath, UpdateProfileAndNotify))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Unable to set the desktop wallpaper.");
        output("Wallpaper set to " + WallpaperPath);
        return 0;
    }
}
