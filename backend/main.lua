local logger = require("logger")
local millennium = require("millennium")
local http = require("http")

-- ====== STATE ======

local cache = {} -- [url] = { body = string, time = number }
local CACHE_TIMEOUT = 5 -- seconds

-- ====== BACKEND API ======

function get_url_data(url, canUseCashe)
    if not string.find(url, "http", 1, true) then
        return nil
    end

    local now = os.time()
    local cacheEntry = cache[url]

    if canUseCashe == "false" or cacheEntry == nil then
        local response, err = http.request(url)

        if response then
            cache[url] = {
                body = response.body,
                time = now
            }
            return response.body
        end

        return nil
    end

    if (now - cacheEntry.time) < CACHE_TIMEOUT then
        return cacheEntry.body
    end

    local response, err = http.request(url)
    if response then
        cache[url] = {
            body = response.body,
            time = now
        }
        return response.body
    end

    return nil
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
