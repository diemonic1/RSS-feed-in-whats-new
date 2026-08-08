-- Sample RSS feed used to visually test how long titles fit into the
-- "What's New" news card. Enabled via TEST_LONG_TITLES in main.lua.

local M = {}

local function xml_escape(text)
    text = tostring(text)
    text = text:gsub("&", "&amp;")
    text = text:gsub("<", "&lt;")
    text = text:gsub(">", "&gt;")
    return text
end

-- Builds a title of EXACTLY `target` characters, starting with "<target> ",
-- repeating `filler` as needed and trimming at the last full word (padding
-- the remainder with spaces to keep the length exact) instead of cutting mid-word.
local function fixed_length_title(target, filler)
    local prefix = tostring(target) .. " "
    local available = target - #prefix
    local body = filler

    while #body < available do
        body = body .. " " .. filler
    end

    if #body > available then
        local trimmed = body:sub(1, available)
        local wordStart = trimmed:find(" [^ ]*$")

        if wordStart and wordStart > 1 then
            trimmed = trimmed:sub(1, wordStart - 1)
        end

        body = trimmed .. string.rep(" ", available - #trimmed)
    end

    return prefix .. body
end

-- The exact headlines reported as overflowing the news card despite being
-- under 125 characters - kept byte-for-byte as given, with no prefix and no
-- modification, so they can be checked directly against the original report.
local LONG_HEADLINES = {
    [[Capcom раскрыла детали следующего обновления для Dragon's Dogma 2: улучшения геймплея и новые инструменты для пешек]],
    [[Microsoft выпустила предварительную версию DirectX Dump Files с диагностикой сбоев графических драйверов в Windows 11]],
    [[Исследование показало, что видеоигры помогают взрослым справляться с одиночеством и укрепляют эмоциональную устойчивость]],
    [["МойОфис" столкнулся с миллиардными убытками и сокращениями - "Лаборатория Касперского" снижает финансирование проекта]],
}

local FILLER_100 = {
    "Indie studio announces surprise sequel featuring rebuilt engine and full co-op campaign support",
    "Publisher delays open-world release by three months to polish performance and fix launch bugs",
}

local FILLER_LONG =
    "Developers detail a major content update covering new levels, balance changes, quality of life " ..
    "improvements, bug fixes and expanded multiplayer options requested by the community since launch"

function M.generate()
    local titles = {}

    for _, headline in ipairs(LONG_HEADLINES) do
        table.insert(titles, headline)
    end

    for _, headline in ipairs(FILLER_100) do
        table.insert(titles, fixed_length_title(100, headline))
    end

    table.insert(titles, fixed_length_title(150, FILLER_LONG))
    table.insert(titles, fixed_length_title(200, FILLER_LONG))
    table.insert(titles, fixed_length_title(250, FILLER_LONG))
    table.insert(titles, fixed_length_title(300, FILLER_LONG))

    local now = os.time()
    local xml = { '<?xml version="1.0" encoding="UTF-8"?>', '<rss version="2.0"><channel>', '<title>Test feed</title>' }

    for i, title in ipairs(titles) do
        local pubDate = os.date("!%a, %d %b %Y %H:%M:%S GMT", now - (i - 1) * 3600)

        table.insert(xml, '<item>')
        table.insert(xml, '<title>' .. xml_escape(title) .. '</title>')
        table.insert(xml, '<link>https://example.com/test-news/' .. i .. '</link>')
        table.insert(xml, '<description>' .. xml_escape("Sample description text for test item " .. i .. ", used only to check the news card layout.") .. '</description>')
        table.insert(xml, '<pubDate>' .. pubDate .. '</pubDate>')
        table.insert(xml, '<enclosure url="https://placehold.co/600x400/1b2838/ffffff.png?text=Test+' .. i .. '" type="image/png" />')
        table.insert(xml, '</item>')
    end

    table.insert(xml, '</channel></rss>')

    return table.concat(xml, "")
end

return M
