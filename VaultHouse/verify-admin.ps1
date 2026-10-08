param([string[]]$Paths = @('InstallStreet.exe','InstallStreet.Cli.exe','RunningHelper.exe'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class ManifestReader {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadLibraryEx(string file, IntPtr ignored, uint flags);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr FindResource(IntPtr module, IntPtr name, IntPtr type);
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr LockResource(IntPtr resource);
 [DllImport("kernel32.dll", SetLastError=true)] static extern uint SizeofResource(IntPtr module, IntPtr resource);
 [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
 public static string Read(string file) {
  IntPtr module=LoadLibraryEx(file,IntPtr.Zero,0x22);
  if(module==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
  try {
   IntPtr resource=FindResource(module,new IntPtr(1),new IntPtr(24));
   if(resource==IntPtr.Zero)throw new Exception("Executable manifest is missing.");
   uint length=SizeofResource(module,resource); IntPtr data=LockResource(LoadResource(module,resource));
   byte[] bytes=new byte[length]; Marshal.Copy(data,bytes,0,(int)length);
   return Encoding.UTF8.GetString(bytes).Trim('\0','\uFEFF');
  }finally{FreeLibrary(module);}
 }
}
"@
foreach ($relative in $Paths) {
    $file = if ([IO.Path]::IsPathRooted($relative)) { $relative } else { Join-Path $root $relative }
    $xml = [xml][ManifestReader]::Read($file)
    $node = $xml.SelectSingleNode('//*[local-name()="requestedExecutionLevel"]')
    if (!$node -or $node.level -ne 'requireAdministrator') { throw "Executable does not require administrator access: $file" }
    Write-Output ('Verified requireAdministrator: ' + $relative)
}
