using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal static class VoidifyPlayer {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool SetWindowText(IntPtr window, string title);
    [DllImport("user32.dll")]
    static extern IntPtr SendMessageTimeout(IntPtr window, uint msg, IntPtr size, IntPtr icon,
                                            uint flags, uint timeout, out IntPtr result);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SetCurrentProcessExplicitAppUserModelID(string id);

    [StructLayout(LayoutKind.Sequential)]
    struct PropertyKey { public Guid format; public uint id; }
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    struct PropVariant {
        [FieldOffset(0)] public ushort type;
        [FieldOffset(8)] public IntPtr text;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface PropertyStore {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value);
        void Commit();
    }
    [DllImport("shell32.dll")]
    static extern int SHGetPropertyStoreForWindow(IntPtr window, ref Guid iid, out PropertyStore store);
    static void SetTaskbarIdentity(IntPtr window, string build) {
        var iid = typeof(PropertyStore).GUID;
        PropertyStore store;
        if (SHGetPropertyStoreForWindow(window, ref iid, out store) != 0) return;
        try {
            var key = new PropertyKey { format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3") };
            foreach (var property in new[] {
                new { id = 2u, value = "\"" + Path.Combine(build, "Voidify.exe") + "\"" },
                new { id = 3u, value = Path.Combine(build, "voidify-taskbar.ico") + ",0" },
                new { id = 5u, value = "Voidify.Desktop.Player" }
            }) {
                key.id = property.id;
                var value = new PropVariant { type = 31, text = Marshal.StringToCoTaskMemUni(property.value) };
                try { store.SetValue(ref key, ref value); }
                finally { Marshal.FreeCoTaskMem(value.text); }
            }
            store.Commit();
        } catch (COMException) {
            // Some shell versions restrict window properties owned by another process.
        } finally { Marshal.ReleaseComObject(store); }
    }

    // The private player uses --cache-path, so its native DevTools setting
    // lives here instead of in the regular Spotify installation's cache.
    static void EnableInspector(string profile) {
        string path = Path.Combine(profile, "Cache", "offline.bnk");
        if (!File.Exists(path)) return; // Created by the player on its first run.
        try {
            using (var file = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) {
                using (var reader = new BinaryReader(file, System.Text.Encoding.ASCII, true)) {
                    byte[] data = reader.ReadBytes(checked((int)file.Length));
                    string cache = System.Text.Encoding.ASCII.GetString(data);
                    const string setting = "app-developer";
                    int first = cache.IndexOf(setting + ">", StringComparison.Ordinal);
                    int last = cache.LastIndexOf(setting + "\t\x01", StringComparison.Ordinal);
                    if (first < 0 || last <= first) return;
                    int a = first + setting.Length + 1, b = last + setting.Length + 2;
                    if (b >= data.Length || data[a] < '0' || data[a] > '2' ||
                        data[b] < '0' || data[b] > '2') return;
                    if (data[a] == '2' && data[b] == '2') return;
                    file.Position = a;
                    file.WriteByte((byte)'2');
                    file.Position = b;
                    file.WriteByte((byte)'2');
                }
            }
        } catch (IOException) { /* A running player can already own the cache. */ }
    }

    [STAThread]
    static int Main() {
        try {
            string build = AppDomain.CurrentDomain.BaseDirectory;
            string client = Path.Combine(build, "Client");
            string profile = Path.Combine(Directory.GetParent(build.TrimEnd(Path.DirectorySeparatorChar)).Parent.FullName, "Profile");
            Directory.CreateDirectory(profile);
            EnableInspector(profile);
            SetCurrentProcessExplicitAppUserModelID("Voidify.Desktop.Player");
            var launch = new ProcessStartInfo(Path.Combine(client, "Spotify.exe"));
            launch.WorkingDirectory = client;
            launch.UseShellExecute = false;
            launch.EnvironmentVariables["APPDATA"] = Path.Combine(profile, "Roaming");
            launch.EnvironmentVariables["LOCALAPPDATA"] = Path.Combine(profile, "Local");
            Directory.CreateDirectory(launch.EnvironmentVariables["APPDATA"]);
            Directory.CreateDirectory(launch.EnvironmentVariables["LOCALAPPDATA"]);
            launch.Arguments = "--mu=voidify --disable-update-restarts --user-data-dir=\"" + profile +
                "\\Browser\" --cache-path=\"" + profile + "\\Cache\" --app-directory=\"" + client + "\\Apps\"";
            using (var player = Process.Start(launch))
            using (var icon = new Icon(Path.Combine(build, "voidify-taskbar.ico"))) {
                IntPtr brandedWindow = IntPtr.Zero;
                while (!player.HasExited) {
                    player.Refresh();
                    var window = player.MainWindowHandle;
                    if (window != IntPtr.Zero && window != brandedWindow) {
                        SetTaskbarIdentity(window, build);
                        IntPtr result;
                        SendMessageTimeout(window, 0x80, IntPtr.Zero, icon.Handle, 2, 500, out result);
                        SendMessageTimeout(window, 0x80, new IntPtr(1), icon.Handle, 2, 500, out result);
                        brandedWindow = window;
                    }
                    if (window != IntPtr.Zero && player.MainWindowTitle != "Voidify") SetWindowText(window, "Voidify");
                    Thread.Sleep(1000);
                }
            }
            return 0;
        } catch (Exception e) {
            MessageBox.Show(e.Message, "Voidify", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}
