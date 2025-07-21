import os
import requests
from bs4 import BeautifulSoup
import urllib.parse
from supabase import create_client, Client
from openai import OpenAI
import json
from playwright.sync_api import sync_playwright

def handler(event, context):
    print("Cognito Intelligence Engine (Playwright for Netlify): Starting run...")
    
    try:
        # Securely load credentials from Netlify environment variables
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
        OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
        TARGET_USER_ID = os.environ.get("TARGET_USER_ID")

        if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, TARGET_USER_ID]):
            raise ValueError("Missing required environment variables.")

        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client = OpenAI(api_key=OPENAI_API_KEY, base_url="https://integrate.api.nvidia.com/v1")

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            # Stage 1: Scrape the News Source
            target_url = "https://www.mutualofomaha.com/about/newsroom/news-releases"
            account_name = "Mutual of Omaha"
            base_url = "https://www.mutualofomaha.com"
            
            page.goto(target_url, wait_until='domcontentloaded')
            
            soup = BeautifulSoup(page.content(), 'html.parser')
            article_links = soup.select("li.news-release-listing-item h3.title a")

            if not article_links:
                browser.close()
                return {
                    "statusCode": 200,
                    "body": json.dumps({"message": "Playwright ran but found no article links."})
                }

            processed_count = 0
            for link in article_links[:3]:
                article_url = urllib.parse.urljoin(base_url, link.get('href'))
                
                existing_alert_res = supabase.table('cognito_alerts').select('id', count='exact').eq('source_url', article_url).execute()
                if existing_alert_res.count > 0:
                    print(f"Skipping already processed article: {article_url}")
                    continue

                page.goto(article_url, wait_until='domcontentloaded')
                article_soup = BeautifulSoup(page.content(), 'html.parser')
                content_area = article_soup.find('div', class_='content')
                
                if not content_area: continue
                
                raw_text = content_area.get_text(separator='\n', strip=True)
                prompt = "You are an expert sales intelligence analyst. Analyze the following press release text..."

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
            
            browser.close()

        return {
            "statusCode": 200,
            "body": json.dumps({"message": f"Run completed. Processed {processed_count} new articles."})
        }

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"An error occurred: {str(e)}"})
        }

