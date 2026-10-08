using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

public static class ScriptTaskRuntime
{
    public static int Execute(Assembly assembly, string root, string task, string mode, Action<string> output)
    {
        if (mode != "Check" && mode != "Run") throw new ArgumentException("Mode must be Check or Run.");
        string script;
        using (Stream resource = assembly.GetManifestResourceStream("InstallStreet.TaskScript.ps1"))
        {
            if (resource == null) throw new InvalidOperationException("Embedded task script is missing.");
            using (StreamReader reader = new StreamReader(resource)) script = reader.ReadToEnd();
        }
        string bootstrap = "$ProgressPreference = 'SilentlyContinue'; try { & ([scriptblock]::Create([Console]::In.ReadToEnd())); if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } } catch { [Console]::Error.WriteLine($_); exit 1 }";
        string encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(bootstrap));
        ProcessStartInfo start = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
            "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand " + encoded);
        string encodedRoot = Convert.ToBase64String(Encoding.Unicode.GetBytes(Path.GetFullPath(root)));
        script = script.Replace("$taskRoot = $env:INSTALLSTREET_TASK_ROOT", "$taskRoot = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('" + encodedRoot + "'))");
        return Capture(start, "& {\n" + script + "\n} -Task '" + task + "' -Mode '" + mode + "'", output);
    }
    public static int RunCli(string root, string arguments, Action<string> output)
    {
        return Capture(new ProcessStartInfo(Path.Combine(root, "InstallStreet.Cli.exe"), arguments), null, output);
    }
    public static int Capture(ProcessStartInfo start, string input, Action<string> output)
    {
        if (output == null) output = delegate(string line) { };
        start.UseShellExecute = false; start.CreateNoWindow = true;
        start.RedirectStandardOutput = true; start.RedirectStandardError = true;
        start.RedirectStandardInput = input != null;
        using (Process process = Process.Start(start))
        {
            object gate = new object();
            Action<StreamReader> pump = delegate(StreamReader reader) { string line; while ((line = reader.ReadLine()) != null) { lock (gate) output(line); } };
            Task stdout = Task.Factory.StartNew(delegate { pump(process.StandardOutput); });
            Task stderr = Task.Factory.StartNew(delegate { pump(process.StandardError); });
            if (input != null) { process.StandardInput.Write(input); process.StandardInput.Close(); }
            process.WaitForExit(); Task.WaitAll(stdout, stderr); return process.ExitCode;
        }
    }
}


