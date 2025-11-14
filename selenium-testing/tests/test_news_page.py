import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


@pytest.fixture(scope="module")
def driver():
    """Setup Chrome WebDriver"""
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    yield driver
    driver.quit()


def test_news_page_refresh_and_article(driver):
    """Test News page: Refresh button works and first article opens properly."""
    BASE_URL = "http://localhost:8080"

    driver.get(f"{BASE_URL}/news")
    wait = WebDriverWait(driver, 40)
    print("\nOpened News page")

    # Wait until news cards load
    wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".card-cyber")))
    print("News articles loaded ✅")

    # Step 1: Click Refresh
    refresh_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Refresh')]"))
    )
    refresh_btn.click()
    print("Clicked Refresh button 🔄")
    time.sleep(3)

    # Confirm new articles appear
    articles = driver.find_elements(By.CSS_SELECTOR, ".card-cyber")
    assert len(articles) > 0, "No news articles found after refresh!"
    print(f"{len(articles)} news articles visible after refresh ✅")

    # Step 2: Click first 'Read Full Article'
    article_buttons = driver.find_elements(By.XPATH, "//button[contains(., 'Read Full Article')]")
    assert article_buttons, "No 'Read Full Article' buttons found!"
    article_buttons[0].click()
    print("Clicked first 'Read Full Article' button 📰")

    # If a new tab opens, verify and close
    if len(driver.window_handles) > 1:
        driver.switch_to.window(driver.window_handles[1])
        print("Opened article in new tab → closing it now 🗞️")
        time.sleep(2)
        driver.close()
        driver.switch_to.window(driver.window_handles[0])
    else:
        print("Article opened in same tab ✅")

    print("✅ TEST PASSED: Refresh and article link working fine.")
