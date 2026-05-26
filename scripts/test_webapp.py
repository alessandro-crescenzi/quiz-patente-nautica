"""Smoke test della webapp con Playwright. Avvia server gia' su 127.0.0.1:8765."""

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "data" / "_screens"
OUT.mkdir(parents=True, exist_ok=True)


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        logs = []
        page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: logs.append(f"PAGEERROR: {err}"))

        # Home
        page.goto("http://127.0.0.1:8765/", wait_until="networkidle")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "01_home.png"), full_page=True)
        print("Home -> screenshot 01_home.png")

        # Anomalie
        page.click('a[href="#/anomalie"]')
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "02_anomalie.png"), full_page=True)
        print("Anomalie -> screenshot 02_anomalie.png")

        # Esame
        page.goto("http://127.0.0.1:8765/#/esame", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "03_esame_q1.png"), full_page=True)
        print("Esame Q1 -> screenshot 03_esame_q1.png")

        # Click su prima risposta
        page.locator(".risp").first.click()
        page.wait_for_timeout(200)
        # Vai a domanda 5
        page.locator('.qnav[data-idx="4"]').click()
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "04_esame_q5.png"), full_page=True)
        print("Esame Q5 -> screenshot 04_esame_q5.png")

        # Sbagliate (vuota)
        page.goto("http://127.0.0.1:8765/#/sbagliate", wait_until="networkidle")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "05_sbagliate.png"), full_page=True)
        print("Sbagliate -> screenshot 05_sbagliate.png")

        # Verifica che tutte le 20 base e 5 vela siano caricate
        # Torno all'esame
        page.goto("http://127.0.0.1:8765/#/esame", wait_until="networkidle")
        page.wait_for_timeout(600)
        nbase = page.locator(".qnav").count()
        print(f"Numero pulsanti navigazione base = {nbase}")

        browser.close()

        print("\n--- Console logs ---")
        for l in logs:
            print(l)


if __name__ == "__main__":
    run()
