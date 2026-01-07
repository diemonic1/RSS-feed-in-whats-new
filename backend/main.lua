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

-- ====== BACKEND API ======

function get_settings()
    return tostring(settings)
end

function get_installPath()
    return tostring(millennium.get_install_path() .. "/plugins/Apps-buttons")
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
