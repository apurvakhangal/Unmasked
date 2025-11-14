import os
import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from tests.pages.login_page import LoginPage
from tests.pages.upload_page import UploadPage

# Absolute path to your test video
UPLOAD_VIDEO_PATH = os.path.abspath("tests/sample.mp4")


@pytest.mark.slow
def test_upload_and_analysis(driver):
    """
    Flow: Login → Upload video → Wait for deepfake analysis → Verify 'Fake' or 'Real' result
    """

    # STEP 1: Login
    login_page = LoginPage(driver)
    print("🌐 Opening login page...")
    login_page.load("http://localhost:8080/login")
    login_page.login("apurva@gmail.com", "apurva@29")

    print("🔑 Waiting for dashboard...")
    WebDriverWait(driver, 30).until(EC.url_contains("/dashboard"))
    time.sleep(3)

    # STEP 2: Navigate to upload page
    print("📂 Navigating to upload page...")
    driver.get("http://localhost:8080/upload")
    WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
    )
    time.sleep(2)

    # STEP 3: Upload video file
    print(f"📤 Uploading video: {UPLOAD_VIDEO_PATH}")
    upload_page = UploadPage(driver)
    upload_page.upload_video(UPLOAD_VIDEO_PATH)
    time.sleep(5)  # Let upload begin

    # STEP 4: Wait for deepfake analysis to complete
    print("🕒 Waiting for analysis result (Fake / Real)...")
    try:
        result_element = WebDriverWait(driver, 600).until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(),'Fake') or contains(text(),'Real') or contains(text(),'Deepfake')]")
            )
        )
        print(f"✅ Analysis complete: {result_element.text}")
    except Exception as e:
        driver.save_screenshot("analysis_timeout.png")
        pytest.fail(f"❌ Analysis did not finish in time. Screenshot saved. Error: {e}")

    # STEP 5: Verify final result
    page_source = driver.page_source.lower()
    assert "fake" in page_source or "real" in page_source, "❌ No analysis result detected in page."

    print("🎉 Test Passed: Deepfake analysis result detected successfully.")
    time.sleep(3)
