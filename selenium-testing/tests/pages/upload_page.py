import os
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class UploadPage:
    def __init__(self, driver):
        self.driver = driver
        self.file_input = (By.CSS_SELECTOR, "input[type='file']")

    def load(self, url):
        self.driver.get(url)

    def upload_video(self, video_path):
        abs_path = os.path.abspath(video_path)
        file_input = WebDriverWait(self.driver, 20).until(
            EC.presence_of_element_located(self.file_input)
        )
        file_input.send_keys(abs_path)
        time.sleep(2)  # give time for upload to start
