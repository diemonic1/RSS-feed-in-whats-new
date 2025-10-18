import Millennium, PluginUtils # type: ignore
import subprocess
import os
import time

logger = PluginUtils.Logger()

try:
    import requests
except:
    logger.log("[RSS-feed-in-whats-new] requests failed to initialize, loading polyfill...")
    from polyfills import requests

settings = ""

lastDownloadingTime = 0
cachedResponse = None

def launchWithoutConsole(command):
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    return subprocess.Popen(command, startupinfo=startupinfo).wait()

class Backend:
    @staticmethod
    def get_settings():
        global settings
        return str(settings)

    @staticmethod
    def get_url_data(url):
        global lastDownloadingTime, cachedResponse

        logger.log("[RSS-feed-in-whats-new] try to get " + url)

        currentTime = time.time()

        if lastDownloadingTime == 0:
            search_response = requests.get(url)
            cachedResponse = search_response.text
            lastDownloadingTime = currentTime
            return cachedResponse

        if currentTime - lastDownloadingTime < 20:
            logger.log("[RSS-feed-in-whats-new] using cached data")
            return cachedResponse

        search_response = requests.get(url)
        cachedResponse = search_response.text
        lastDownloadingTime = currentTime
        logger.log("[RSS-feed-in-whats-new] cache updated")

        return cachedResponse

    @staticmethod
    def print_log(text):
        logger.log("[RSS-feed-in-whats-new] " + text)

    @staticmethod
    def print_error(text):
        raise Exception("[RSS-feed-in-whats-new] " + text)

    @staticmethod
    def call_back(app_path):
        logger.log("start call_back with path: " + app_path)

        try:
            osResult = launchWithoutConsole(["cmd", "/c", "start", "", str(app_path)])

            if (osResult == 0):
                logger.log("call_back success, open file : " + app_path)
                return "success"
            else:
                logger.log("call_back fail : " + app_path + ", osResult is " + str(osResult))
                return "fail"
        except Exception as e:
            logger.log("call_back fail : " + app_path + ", Exception is " + str(e))
            return "fail"

class Plugin:
    def _front_end_loaded(self):
        logger.log("Frontend loaded")

    def _load(self):
        logger.log(f"Plugin base dir: {PLUGIN_BASE_DIR}")

        settings_dir = os.path.join(PLUGIN_BASE_DIR, "settings.json")

        logger.log("settings path: " + settings_dir)

        with open(settings_dir) as file:
            global settings
            settings = file.read()
            logger.log("settings loaded: " + settings)

        logger.log("Backend loaded")
        Millennium.ready()

    def _unload(self):
        logger.log("Unloading")
