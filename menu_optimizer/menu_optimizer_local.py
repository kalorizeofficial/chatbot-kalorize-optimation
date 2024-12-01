import sys
from typing import List, Dict
from dataclasses import dataclass
import requests

@dataclass
class MenuItem:
    name: str
    price: int
    category: str

def load_menu_data(phone_number, token):
    default_data = {
         "Protein": {
        "Tempe": 1000,
        "Tempe Kering": 3000,
        "Telur Asin": 2000,
        "Ikan Lele": 6000,
        "Ikan Tongkol": 4000,
        "Telur Goreng": 5000,
        "Telur Ceplok": 5000,
        "Daging Sapi": 7000,
        "Tahu": 1500,
        "Udang Goreng": 8000,
        "Ayam Bakar": 6000,
        "Ikan Bakar": 7000,
        "Rendang": 9000,
        "Gulai Kambing": 10000,
        "Sate Ayam": 7000,
        "Semur Daging": 8000,
        "Ayam Geprek": 6000,
        "Kikil Sapi": 4000,
        "Bakso Sapi": 5000,
        "Sosis Ayam": 3000,
        "Ikan Patin": 6500,
        "Cumi Goreng": 8500,
        "Ikan Salmon": 10000,
        "Tuna Bakar": 9000,
        "Ikan Kembung": 5000,
        "Pepes Ikan": 7000,
        "Ayam Kremes": 6000,
        "Ayam Teriyaki": 7000
    },
    "Karbohidrat": {
        "Perkedel": 2000,
        "Bakwan": 1500,
        "Nasi Goreng": 5000,
        "Nasi Uduk": 4500,
        "Lontong": 2000,
        "Roti Tawar": 1500,
        "Bihun Goreng": 3500,
        "Mie Goreng": 4000
    },
    "Sayur": {
        "Urap-Urap": 3500,
        "Sayur Asem": 3500,
        "Sayur Sop": 4000,
        "Pecel": 3000,
        "Gado-Gado": 4500,
        "Sayur Kangkung": 3000,
        "Capcay": 5000,
        "Sayur Bening": 3000,
        "Tumis Tauge": 2500,
        "Oseng Tempe Kacang Panjang": 3500,
        "Tumis Brokoli": 4000,
        "Sup Wortel": 3500
    },
    "Buah": {
        "Rujak Buah": 3500,
        "Buah Naga": 3000,
        "Pisang": 2000,
        "Semangka": 1500,
        "Melon": 2000,
        "Apel": 2500,
        "Jeruk": 2000,
        "Mangga": 3000
    },
    "Pelengkap": {
        "Sambal Goreng Kentang": 3000,
        "Acar": 1000,
        "Emping": 2000,
        "Rempeyek": 1500,
        "Telur Puyuh": 2500,
        "Tempe Mendoan": 2000,
        "Keripik Singkong": 1500,
        "Tahu Isi": 2000
    }
    }
    
    try:
        headers = {
            'Authorization': f'Bearer {token}'
        }
        response = requests.get(f'http://admin-chatbot.kalorize.com:90/api/mitra/json/{phone_number}', headers=headers)
        response.raise_for_status()
        data = response.json()

        if not data.get('success', False):
            raise ValueError(f"API response tidak berhasil: {data.get('message', 'Unknown error')}")

        menu_data = data.get('data', {}).get('menu_data', {})
        if not menu_data:
            raise ValueError("API tidak mengembalikan data menu.")

    except (requests.exceptions.RequestException, ValueError) as e:
        # print("*Anda belum memberikan data makanan kepada kami!*\n\n*Berikut adalah contoh yang akan kami berikan kepada anda.*")
        menu_data = default_data

    category_items = {}
    for category, items in menu_data.items():
        menu_items = [MenuItem(name=name, price=price, category=category) for name, price in items.items()]
        category_items[category] = menu_items

    return category_items


    

def dynamic_programming_mckp(
    categories: List[str],
    category_items: Dict[str, List[MenuItem]],
    budget_per_person: int
) -> List[tuple[int, List[MenuItem]]]:
    """
    Solve the Multi-choice Knapsack Problem using dynamic programming.
    Returns a list of menu combinations with their total price per person.
    """
    # Initialize DP table
    dp = [{} for _ in range(len(categories) + 1)]
    dp[0][0] = []

    # Iterate over categories
    for i, category in enumerate(categories, 1):
        items = category_items[category]
        dp_current = {}
        # Iterate over all accumulated prices so far
        for total_price, combination in dp[i - 1].items():
            # Try adding each item from the current category
            for item in items:
                new_total_price = total_price + item.price
                if new_total_price <= budget_per_person:
                    if new_total_price not in dp_current or len(dp_current[new_total_price]) == 0:
                        dp_current[new_total_price] = combination + [item]
        dp[i] = dp_current

    # Extract all combinations that reach the last category
    last_dp = dp[-1]
    # Sort combinations by total_price descending
    sorted_combinations = sorted(last_dp.items(), key=lambda x: -x[0])

    return sorted_combinations
def get_optimal_menus_dp(category_items: Dict[str, List[MenuItem]], budget: int, num_people: int, max_results: int):
    # Sama seperti sebelumnya: Menggunakan dynamic programming untuk mendapatkan kombinasi terbaik
    budget_per_person = budget // num_people
    categories = list(category_items.keys())
    combinations = dynamic_programming_mckp(categories, category_items, budget_per_person)

    if not combinations:
        return []

    optimal_menus = []
    for total_price_per_person, items in combinations:
        total_cost = total_price_per_person * num_people
        if total_cost <= budget:
            optimal_menus.append({
                "items": [item.name for item in items],
                "total_price_per_person": total_price_per_person,
                "total_cost": total_cost
            })
            if len(optimal_menus) == max_results:
                break

    return optimal_menus

def run_optimizer(total_budget, number_of_people, max_results, phone_number, token):
    # Memuat data menu berdasarkan nomor telepon
    category_items = load_menu_data(phone_number, token)

    # Mendapatkan menu terbaik
    optimal_menus = get_optimal_menus_dp(category_items, total_budget, number_of_people, max_results)

    # Menampilkan hasil
    if optimal_menus:
        print(f"\nOptimasi menu kombinasi berdasarkan\n -> jumlah nominal uang *Rp.{total_budget:,}*\n -> untuk *{number_of_people}* porsi\n")
       
        for idx, menu in enumerate(optimal_menus, start=1):
            print("=" * 33)
            print(f"M E N U : {idx}".center(65))
            print("=" * 33)
            print(f"\n  Makanan:")
            for item in menu['items']:
                # Directly using the item name and price for output
                item_price = next((menu_item.price for cat_items in category_items.values() for menu_item in cat_items if menu_item.name == item), None)
                print(f"    *- {item}* : Rp.{item_price:>8,}")
            print(f"\n  Harga Per Porsi : *Rp.{menu['total_price_per_person']:,}*")
            print(f"  Total {number_of_people} Porsi : *Rp.{menu['total_cost']:,}*\n")
        thank_you_message = "K A L O R I Z E  C H A T  B O T"
        total_width = 55  # You can adjust this width based on your console size
        centered_message = thank_you_message.center(total_width)

        print("=" * 33)
        print(f"\n{centered_message}\n")
        print("=" * 33)
        
    else:
        print(f"\nTidak ada Kombinasi dengan jumlah nominal uang *Rp.{total_budget:,}* .")

import traceback
if __name__ == "__main__":
    if len(sys.argv) != 6:
        print("Usage: python menu_optimizer_local.py <total_budget> <number_of_people> <max_results> <phone_number> <token>")
    else:
        total_budget = float(sys.argv[1])
        number_of_people = int(sys.argv[2])
        max_results = int(sys.argv[3])
        phone_number = sys.argv[4]
        token = sys.argv[5]
        run_optimizer(total_budget, number_of_people, max_results, phone_number, token)


