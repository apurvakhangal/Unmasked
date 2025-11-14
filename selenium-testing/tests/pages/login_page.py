from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class LoginPage:
    def __init__(self, driver):
        self.driver = driver
        self.email = (By.ID, "email")
        self.password = (By.ID, "password")
        self.sign_in_button = (By.CSS_SELECTOR, "button[type='submit']")
        self.error_message = (By.CSS_SELECTOR, "p.text-red-500")

    def load(self, url):
        self.driver.get(url)

    def login(self, email, pwd):
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located(self.email)
        )
        self.driver.find_element(*self.email).clear()
        self.driver.find_element(*self.email).send_keys(email)
        self.driver.find_element(*self.password).clear()
        self.driver.find_element(*self.password).send_keys(pwd)
        self.driver.find_element(*self.sign_in_button).click()

    def get_error_message(self):
        try:
            return WebDriverWait(self.driver, 5).until(
                EC.visibility_of_element_located(self.error_message)
            ).text
        except:
            return None
