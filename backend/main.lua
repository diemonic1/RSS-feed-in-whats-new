local logger = require("logger")
local millennium = require("millennium")
local http = require("http")

-- ====== STATE ======

local settings = ""
local lastDownloadingTime = 0
local cachedResponse = nil
local CACHE_TIMEOUT = 20 -- seconds

-- ====== read_file ======

local function read_file(path)
    local file = io.open(path, "r")
    if not file then
        return nil
    end
    local content = file:read("*a")
    file:close()
    return content
end

-- ====== launch_without_console ======

local ffi = require("ffi")

ffi.cdef[[
typedef unsigned long DWORD;
typedef int BOOL;
typedef void* HANDLE;
typedef const char* LPCSTR;
typedef char* LPSTR;

typedef struct {
  DWORD cb;
  LPSTR lpReserved;
  LPSTR lpDesktop;
  LPSTR lpTitle;
  DWORD dwX;
  DWORD dwY;
  DWORD dwXSize;
  DWORD dwYSize;
  DWORD dwXCountChars;
  DWORD dwYCountChars;
  DWORD dwFillAttribute;
  DWORD dwFlags;
  unsigned short wShowWindow;
  unsigned short cbReserved2;
  void* lpReserved2;
  HANDLE hStdInput;
  HANDLE hStdOutput;
  HANDLE hStdError;
} STARTUPINFOA;

typedef struct {
  HANDLE hProcess;
  HANDLE hThread;
  DWORD dwProcessId;
  DWORD dwThreadId;
} PROCESS_INFORMATION;

BOOL CreateProcessA(
  LPCSTR lpApplicationName,
  LPSTR lpCommandLine,
  void* lpProcessAttributes,
  void* lpThreadAttributes,
  BOOL bInheritHandles,
  DWORD dwCreationFlags,
  void* lpEnvironment,
  LPCSTR lpCurrentDirectory,
  STARTUPINFOA* lpStartupInfo,
  PROCESS_INFORMATION* lpProcessInformation
);

BOOL CloseHandle(HANDLE hObject);
]]

local CREATE_NO_WINDOW     = 0x08000000
local STARTF_USESHOWWINDOW = 0x00000001
local SW_HIDE              = 0

local function launch_without_console(path)
    local command = string.format('cmd /c start "" /B "%s"', path)
    local si = ffi.new("STARTUPINFOA")
    si.cb = ffi.sizeof(si)
    si.dwFlags = STARTF_USESHOWWINDOW
    si.wShowWindow = SW_HIDE

    local pi = ffi.new("PROCESS_INFORMATION")

    -- ВАЖНО: CreateProcess МЕНЯЕТ строку → нужен mutable buffer
    local cmd = ffi.new("char[?]", #command + 1)
    ffi.copy(cmd, command)

    local ok = ffi.C.CreateProcessA(
        nil,
        cmd,
        nil,
        nil,
        false,
        CREATE_NO_WINDOW,
        nil,
        nil,
        si,
        pi
    )

    if ok == 0 then
        return false
    end

    ffi.C.CloseHandle(pi.hThread)
    ffi.C.CloseHandle(pi.hProcess)
    return true
end

local function launch_with_console(path)
    local command = string.format('cmd /c start "" /B "%s"', path)
    return os.execute(command)
end

-- ====== BACKEND API ======

function get_settings()
    return tostring(settings)
end

function open_github()
    return launch_without_console("https://github.com/diemonic1/RSS-feed-in-whats-new")
end

function open_settings()
    return launch_without_console(millennium.get_install_path() .. "/plugins/RSS-feed-in-whats-new")
end

function get_url_data(url)
    logger:info("[RSS-feed-in-whats-new] try to get " .. url)

    local now = os.time()

    if lastDownloadingTime == 0 then
        local response, err = http.request(url)
        
        if response then
            cachedResponse = response.body
            lastDownloadingTime = now
            return cachedResponse
        end
    end

    if (now - lastDownloadingTime) < CACHE_TIMEOUT then
        logger:info("[RSS-feed-in-whats-new] using cached data")
        return cachedResponse
    end

    local response, err = http.request(url)
    if response then
        cachedResponse = response.body
        lastDownloadingTime = now
        logger:info("[RSS-feed-in-whats-new] cache updated")

        return cachedResponse
    end
end

function print_log(text)
    logger:info("[RSS-feed-in-whats-new] " .. tostring(text));
    return "[RSS-feed-in-whats-new] " .. tostring(text);
end

function print_error(text)
    logger:error("[RSS-feed-in-whats-new] " .. tostring(text));
    return "[RSS-feed-in-whats-new] " .. tostring(text);
end

function call_back(app_path)
    logger:info("start call_back with path: " .. app_path)

    local result = launch_without_console(app_path)

    if result == 0 or result == true then
        logger:info("call_back launch_without_console success, open file: " .. app_path)
        return "success"
    end

    local result = launch_with_console(app_path)

    if result == 0 or result == true then
        logger:info("call_back launch_with_console success, open file: " .. app_path)
        return "success"
    end

    logger:error("call_back fail: " .. app_path .. " | " .. tostring(result))
    return "fail"
end

-- ====== PLUGIN LIFECYCLE ======

local function on_load()
    logger:info("Comparing millennium version: " .. millennium.cmp_version(millennium.version(), "2.29.3"))
    logger:info("RSS in whats new plugin loaded with Millennium version " .. millennium.version())

    logger:info("Plugin base dir: " .. millennium.get_install_path())

    local settings_path = millennium.get_install_path() .. "/plugins/RSS-feed-in-whats-new/settings.json"
    logger:info("settings path: " .. settings_path)

    local content = read_file(settings_path)
    if content then
        settings = content
        logger:info("settings loaded: " .. settings)
    else
        logger:error("failed to load settings.json")
    end
    millennium.ready()
end

local function on_unload()
    logger:info("Plugin RSS in whats new unloaded")
end

local function on_frontend_loaded()
    logger:info("Frontend loaded")
end

return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload
}
