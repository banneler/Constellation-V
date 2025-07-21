import os
import requests
from bs4 import BeautifulSoup
import urllib.parse
from supabase import create_client, Client
from openai import OpenAI
from http.server import BaseHTTPRequestHandler
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("Cognito Intelligence Engine (Selenium): Starting run...")

        # --- Securely load credentials from Vercel environment variables ---
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
        OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
        TARGET_USER_ID = os.environ.get("TARGET_USER_ID")

        if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, TARGET_USER_ID]):
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"Missing required environment variables.")
            return

        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client = OpenAI(api_key=OPENAI_API_KEY, base_url="https://integrate.api.nvidia.com/v1")

        # --- Configure Selenium for Vercel/Headless environment ---
        options = Options()
        options.binary_location = '/opt/google/chrome/chrome'
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1280x1696")
        options.add_argument("--single-process")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-dev-tools")
        options.add_argument("--no-zygote")
        
        # *** THE FIX: Point all temporary directories to the writable /tmp folder ***
        options.add_argument("--user-data-dir=/tmp/user-data")
        options.add_argument("--data-path=/tmp/data-path")
        options.add_argument("--disk-cache-dir=/tmp/cache-dir")
        
        driver = webdriver.Chrome(options=options)
        
        # --- Stage 1: Scrape the News Source using Selenium ---
        target_url = "https://www.mutualofomaha.com/about/newsroom/news-releases"
        account_name = "Mutual of Omaha"
        base_url = "https://www.mutualofomaha.com"

        try:
            driver.get(target_url)
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "li.news-release-listing-item h3.title a"))
            )
            
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            article_links = soup.select("li.news-release-listing-item h3.title a")
            
            if not article_links:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"message": "Selenium ran but found no article links."}')
                return
            
            processed_count = 0
            for link in article_links[:3]:
                article_url = urllib.parse.urljoin(base_url, link.get('href'))
                
                existing_alert_res = supabase.table('cognito_alerts').select('id', count='exact').eq('source_url', article_url).execute()
                if existing_alert_res.count > 0:
                    print(f"Skipping already processed article: {article_url}")
                    continue

                driver.get(article_url)
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CLASS_NAME, "content")))
                article_soup = BeautifulSoup(driver.page_source, 'html.parser')
                content_area = article_soup.find('div', class_='content')
                
                if not content_area: continue
                
                raw_text = content_area.get_text(separator='\n', strip=True)
                prompt = "You are an expert sales intelligence analyst..."
                
                completion = client.chat.completions.create(
                    model="google/gemini-pro",
                    messages=[{"role": "system", "content": prompt}, {"role": "user", "content": raw_text[:4000]}],
                )
                ai_response = completion.choices[0].message.content
                
                try:
                    analysis = json.loads(ai_response)
                    if analysis.get("trigger_type") != "None":
                        account_res = supabase.table('accounts').select('id').eq('name', account_name).single().execute()
                        if account_res.data:
                            supabase.table('cognito_alerts').insert({
                                'account_id': account_res.data['id'],
                                'user_id': TARGET_USER_ID,
                                'trigger_type': analysis['trigger_type'],
                                'headline': analysis['headline'],
                                'summary': analysis['summary'],
                                'source_url': article_url,
                                'source_name': "Mutual of Omaha Newsroom"
                            }).execute()
                            processed_count += 1
                except Exception as e:
                    print(f"Error processing AI response: {e}")

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"message": f"Run completed. Processed {processed_count} new articles."}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"An error occurred with Selenium: {str(e)}"}).encode())
        finally:
            driver.quit()
        return
