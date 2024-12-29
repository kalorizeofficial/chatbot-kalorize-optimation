import requests
import os
import random
import sys
import json

# Fungsi untuk mengambil data dari API
def load_menu_data(phone_number, token):
    default_data = [
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tempe goreng", "Skor": 12, "Total Harga": 16000},
        {"Karbohidrat": "Nasi putih", "Protein": "Lele goreng", "Sayuran": "Sayur bayam", "Pelengkap": "Sambal kecap", "Skor": 15, "Total Harga": 18000},
        {"Karbohidrat": "Nasi merah", "Protein": "Ayam bakar", "Sayuran": "Tumis kacang panjang", "Pelengkap": "Tahu goreng", "Skor": 14, "Total Harga": 17500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Kerupuk", "Skor": 12, "Total Harga": 15500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Sambal bajak", "Skor": 13, "Total Harga": 18000},
    ]

    try:
        headers = {'Authorization': f'Bearer {token}'}
        url = f'https://chatbot.kalorize.com/api/mitra/json/{phone_number}'
        print(f"Mengakses API: {url} dengan token {token}")

        response = requests.get(url, headers=headers)
        response.raise_for_status()

        data = response.json()
        print(f"Respons API: {data}")  # Debugging log

        if not data.get('success', False):
            print("API response unsuccessful. Menggunakan data default.")
            return default_data

        menu_data = data.get('data', {}).get('menu_data')
        if not menu_data:
            print("Menu data kosong. Menggunakan data default.")
            return default_data

        print("Data menu berhasil diambil dari API.")
        return menu_data

    except requests.exceptions.RequestException as e:
        print(f"Error saat melakukan request ke API: {e}. Menggunakan data default.")
    except ValueError as e:
        print(f"Error saat memproses respons JSON: {e}. Menggunakan data default.")

    print("Menggunakan data default karena kesalahan.")
    return default_data


def calculate_monthly_menu(menu_data, jumlah_porsi, budget, jumlah_hari_menu, makan_per_hari):
    harga_per_porsi = budget / jumlah_porsi
    print(f"Harga per porsi yang diinginkan: {harga_per_porsi:.2f} IDR")

    # Filter makanan dengan harga == harga per porsi
    filtered_data = [menu for menu in menu_data if menu["Total Harga"] == harga_per_porsi]

    if not filtered_data:
        print("Tidak ada data menu yang sesuai dengan harga per porsi.")
        return []

    # Pastikan jumlah menu unik cukup
    if len(filtered_data) < jumlah_hari_menu:
        print(f"Jumlah menu unik tidak cukup. Menggunakan seluruh data yang tersedia.")
        filtered_data = (filtered_data * ((jumlah_hari_menu // len(filtered_data)) + 1))[:jumlah_hari_menu]

    # Distribusikan menu berdasarkan jumlah_hari_menu
    total_makan = 30 * makan_per_hari
    complete_menu = []
    for i in range(total_makan):
        complete_menu.append(filtered_data[i % (jumlah_hari_menu * makan_per_hari)])

    # Tambahkan informasi hari dan makan ke setiap menu
    menu_output = []
    for i, menu in enumerate(complete_menu):
        hari_ke = (i // makan_per_hari) + 1
        makan_ke = (i % makan_per_hari) + 1
        menu_output.append({
            "Hari Ke": hari_ke,
            "Makan Ke": makan_ke,
            "Karbohidrat": menu["Karbohidrat"],
            "Protein": menu["Protein"],
            "Sayuran": menu["Sayuran"],
            "Pelengkap": menu["Pelengkap"],
            "Total Harga": menu["Total Harga"]
        })
    return menu_output


def save_to_json(data, phone_number, filename_prefix="output_bulanan"):
    """
    Fungsi untuk menyimpan data ke dalam file JSON dengan format rapi.
    File akan disimpan di folder ./outputJson dengan nama file yang mencakup phone_number saja.
    """
    try:
        filename = f"{filename_prefix}_{phone_number}.json"
        output_folder = "./outputJson"
        os.makedirs(output_folder, exist_ok=True)

        full_path = os.path.join(output_folder, filename)
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        return full_path
    except Exception as e:
        print(f"Error saat menyimpan ke file JSON: {e}")
        return None


if __name__ == "__main__":
    if len(sys.argv) != 7:
        print("Usage: python script.py <phone_number> <token> <jumlah_porsi> <budget> <jumlah_hari_menu> <makan_per_hari>")
        sys.exit(1)

    try:
        phone_number = sys.argv[1]
        token = sys.argv[2]
        jumlah_porsi = int(sys.argv[3])
        budget = int(sys.argv[4])
        jumlah_hari_menu = int(sys.argv[5])
        makan_per_hari = int(sys.argv[6])
    except ValueError as e:
        print(f"Error: {e}. Pastikan semua parameter valid.")
        sys.exit(1)

    menu_data = load_menu_data(phone_number, token)
    results = calculate_monthly_menu(menu_data, jumlah_porsi, budget, jumlah_hari_menu, makan_per_hari)

    if results:
        filename = save_to_json(results, phone_number)
        if filename:
            print(f"Hasil telah disimpan ke file: {filename}")
        else:
            print("Gagal menyimpan hasil ke file JSON.")
    else:
        print("Maaf, tidak ada menu yang sesuai dengan budget Anda.")
