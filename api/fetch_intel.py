import os
import requests
from bs4 import BeautifulSoup
import urllib.parse
from supabase import create_client, Client
from openai import OpenAI
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("Cognito Intelligence Engine: Starting run...")

        # --- Securely load credentials from Vercel environment variables ---
        SUPABASE_URL = os.environ.get("SUPABASE_URL")
        SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
        OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
        TARGET_USER_ID = os.environ.get("TARGET_USER_ID")

        if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY, TARGET_USER_ID]):
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing required environment variables."}).encode())
            return

        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client = OpenAI(api_key=OPENAI_API_KEY, base_url="https://integrate.api.nvidia.com/v1")

        # --- Stage 1: Scrape the News Source ---
        target_url = "https://www.mutualofomaha.com/about/newsroom/news-releases"
        account_name = "Mutual of Omaha"
        base_url = "https://www.mutualofomaha.com"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

        try:
            response = requests.get(target_url, headers=headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # *** FINAL, MORE ROBUST SELECTOR ***
            # Finds all list items, then finds the link within the h3 tag inside it.
            article_links = soup.select("li.news-release-listing-item h3.title a")

            if not article_links:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"message": "Selector failed again. No articles found."}).encode())
                return
            
            processed_count = 0
            for link in article_links[:3]:
                article_url = urllib.parse.urljoin(base_url, link.get('href'))
                
                existing_alert_res = supabase.table('cognito_alerts').select('id', count='exact').eq('source_url', article_url).execute()
                if existing_alert_res.count > 0:
                    print(f"Skipping already processed article: {article_url}")
                    continue

                article_response = requests.get(article_url, headers=headers)
                article_soup = BeautifulSoup(article_response.content, 'html.parser')
                content_area = article_soup.find('div', class_='content')
                
                if not content_area: continue

                raw_text = content_area.get_text(separator='\n', strip=True)

                prompt = "You are an expert sales intelligence analyst. Analyze the following press release text and determine if it contains an actionable trigger for a telecommunications salesperson. The triggers are: 'C-Suite Change', 'Expansion' (new offices, significant hiring), or 'Technology' (new tech initiatives, digital transformation). If a trigger is found, provide a JSON object with: trigger_type, headline, summary. The headline should be a concise, impactful title. The summary should be a 2-sentence explanation of the news and its relevance. If no trigger is found, respond with {\"trigger_type\": \"None\"}."
                
                completion = client.chat.completions.create(
                    model="google/gemini-pro",
                    messages=[{"role": "system", "content": prompt}, {"role": "user", "content": raw_text[:4000]}],
                    temperature=0.5,
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
            self.wfile.write(json.dumps({"message": f"Cognito engine run completed. Processed {processed_count} new articles."}).encode())

        except requests.exceptions.RequestException as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Error scraping source: {str(e)}"}).encode())
        return
