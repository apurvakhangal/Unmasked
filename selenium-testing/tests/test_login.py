import time
from tests.pages.login_page import LoginPage

def test_invalid_login(driver):
    url = "http://localhost:8080/login"  # Change if your app runs on a different port
    page = LoginPage(driver)
    page.load(url)
    page.login("wrong@user.com", "invalidpass")
    time.sleep(1)
    assert "Invalid email or password" in (page.get_error_message() or "")

def test_valid_login(driver):
    url = "http://localhost:8080/login"
    page = LoginPage(driver)
    page.load(url)
    page.login("apurva@gmail.com", "apurva@29")  # use actual working credentials
    time.sleep(2)
    assert "/dashboard" in driver.current_url
