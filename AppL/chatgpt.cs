using System;
using System.Reflection;

public static class InstallStreetTask
{
    public static int Execute(string root, string mode, Action<string> output)
    {
        return ScriptTaskRuntime.Execute(Assembly.GetExecutingAssembly(), root, "chatgpt", mode, output);
    }
}
