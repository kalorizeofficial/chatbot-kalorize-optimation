import itertools
import requests
import os
import random
import sys

# Fungsi untuk mengambil data dari API
def load_menu_data(phone_number, token):
    default_data = [
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tempe goreng", "Skor": 12, "Total Harga": 16000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tahu goreng", "Skor": 12, "Total Harga": 16500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Kerupuk", "Skor": 12, "Total Harga": 15500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Sambal terasi", "Skor": 12, "Total Harga": 17000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Sambal bajak", "Skor": 12, "Total Harga": 18000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Serundeng", "Skor": 12, "Total Harga": 15500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Lalapan segar", "Skor": 12, "Total Harga": 16000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tempe mendoan", "Skor": 12, "Total Harga": 17000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis bayam", "Pelengkap": "Tempe goreng", "Skor": 12, "Total Harga": 15500}
    ]

    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f'https://chatbot.kalorize.com/api/mitra/json/{phone_number}', headers=headers)
        response.raise_for_status()
        data = response.json()

        if not data.get('success', False):
            raise ValueError("API response unsuccessful")

        menu_data = data.get('data', {}).get('menu_data', default_data)
    except (requests.exceptions.RequestException, ValueError):
        menu_data = default_data

    return menu_data

def calculate_combinations(menu_data, jumlah_porsi, budget):
    # Kalkulasi harga per porsi
    harga_per_porsi = budget / jumlah_porsi

    # Filter makanan dengan harga <= harga per porsi
    filtered_data = [menu for menu in menu_data if menu["Total Harga"] == harga_per_porsi]

    # Acak hasil
    random.shuffle(filtered_data)

    # Pilih 3 kombinasi terbaik dari hasil acak
    best_combinations = filtered_data[:3]

    return best_combinations

def run_optimizer(phone_number, token, jumlah_porsi, budget):
    # Ambil data menu dari API
    menu_data = load_menu_data(phone_number, token)

    # Hitung kombinasi terbaik
    best_combinations = calculate_combinations(menu_data, jumlah_porsi, budget)

    # Format output
    output = []
    for menu in best_combinations:
        output.append({
            "Karbohidrat": menu["Karbohidrat"],
            "Protein": menu["Protein"],
            "Sayuran": menu["Sayuran"],
            "Pelengkap": menu["Pelengkap"],
            "Total Harga": menu["Total Harga"]
        })
    return output

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python script.py <phone_number> <token> <jumlah_porsi> <budget>")
        sys.exit(1)

    phone_number = sys.argv[1]
    token = sys.argv[2]
    jumlah_porsi = int(sys.argv[3])
    budget = int(sys.argv[4])

    results = run_optimizer(phone_number, token, jumlah_porsi, budget)

    if not results:
        print("Data tidak ada")
    else:
        for idx, result in enumerate(results, start=1):
            print(f"Menu {idx}:")
            print(f"  Karbohidrat: {result['Karbohidrat']}")
            print(f"  Protein: {result['Protein']}")
            print(f"  Sayuran: {result['Sayuran']}")
            print(f"  Pelengkap: {result['Pelengkap']}")
            print(f"  Total Harga: Rp{result['Total Harga']:,}")
            print()
