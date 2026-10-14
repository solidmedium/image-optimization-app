// Chromium-only File System Access APIs that TypeScript's DOM lib doesn't declare.
// https://wicg.github.io/file-system-access/

type FileSystemPermissionMode = "read" | "readwrite"

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor
  ): Promise<PermissionState>
}

interface DirectoryPickerOptions {
  /** Lets the browser remember the last folder picked for this id. */
  id?: string
  mode?: FileSystemPermissionMode
  startIn?:
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos"
    | FileSystemHandle
}

interface Window {
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions
  ) => Promise<FileSystemDirectoryHandle>
}
