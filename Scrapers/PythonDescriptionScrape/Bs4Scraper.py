import time
import requests
from bs4 import BeautifulSoup
from multiprocessing import Pool
import json

def scrape_product_data(product):
    url = product['link']
    response = requests.get(url)
    if response.status_code != 200:
        print(f"Failed to retrieve {url}")
        return None

    soup = BeautifulSoup(response.text, 'html.parser')
    
    time.sleep(2)  # Wait for 2 seconds

    # Find all divs with the specified class name
    all_divs = soup.find_all('div', {'class': '_1AtVbE col-12-12'})
    if len(all_divs) < 15:
        print(f"Less than 15 divs found for {url}")
        return None

    # Access the 15th div
    target_div = all_divs[14]

    # Locate the first element within the target div that matches the specified class
    first_description_div = target_div.find('div', {'class': '_2k6Cpt'})
    if first_description_div is None:
        print(f"Failed to find description div for {url}")
        return None

    # Extract description text from the first description div and any subsequent description divs with the class '_2k6Cpt'
    descriptions = first_description_div.find_all('div', {'class': '_2k6Cpt'})
    description_text = [desc.get_text(separator=' ', strip=True) for desc in descriptions]

    return {
        'name': product['name'],
        'link': product['link'],
        'description': ' '.join(description_text)
    }

def main():
    with open('../PuppteerLinkScraper/products.json', 'r') as file:
        products = json.load(file)

    with Pool(15) as pool:
        new_data = pool.map(scrape_product_data, products)

    # Filter out any failed scrapes (None values)
    new_data = [product for product in new_data if product]

    with open('new_data.json', 'w') as file:
        json.dump(new_data, file, indent=4)

if __name__ == "__main__":
    main()
