local logger = require("logger")
local millennium = require("millennium")
local http = require("http")
local test_data = require("test_data")

-- ====== STATE ======

local cache = {} -- [url] = { body = string, time = number }
local CACHE_TIMEOUT = 5 -- seconds

-- Some feeds (e.g. gamestar.de) sit behind Cloudflare and answer the default
-- Lua-HTTP user agent with a 403 challenge page instead of the RSS document.
local REQUEST_OPTIONS = {
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    headers = {
        ["Accept"] = "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
    },
    timeout = 30
}

-- Returns the body only for successful responses, so callers never receive a
-- block/error page that would later fail XML parsing.
local function fetch(url)
    local response, err = http.request(url, REQUEST_OPTIONS)

    if not response then
        logger:error("[RSS-feed-in-whats-new] request failed for " .. tostring(url) .. ": " .. tostring(err))
        return nil
    end

    if response.status < 200 or response.status >= 300 then
        logger:error("[RSS-feed-in-whats-new] request for " .. tostring(url) .. " returned status " .. tostring(response.status))
        return nil
    end

    return response.body
end

-- Set to true and rebuild the plugin to serve a fixed set of long-title test
-- news instead of the real RSS feed (see test_data.lua). Cannot be toggled
-- from the built plugin - it requires editing this file and rebuilding.
local TEST_LONG_TITLES = false

-- ====== BACKEND API ======

function get_url_data(url, canUseCashe)
    if TEST_LONG_TITLES then
        return test_data.generate()
    end

    if not string.find(url, "http", 1, true) then
        return nil
    end

    local now = os.time()
    local cacheEntry = cache[url]

    if canUseCashe == "false" or cacheEntry == nil then
        local body = fetch(url)

        if body then
            cache[url] = {
                body = body,
                time = now
            }
            return body
        end

        return nil
    end

    if (now - cacheEntry.time) < CACHE_TIMEOUT then
        return cacheEntry.body
    end

    local body = fetch(url)
    if body then
        cache[url] = {
            body = body,
            time = now
        }
        return body
    end

    -- Serve the last known good copy rather than nothing when a refresh fails.
    return cacheEntry.body
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
